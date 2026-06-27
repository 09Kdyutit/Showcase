import type { JobProvider, JobSearchParams, JobSearchResult } from './types'
import type { JobListing, Seniority, WorkMode, EmploymentType } from '@/types/database'

const BASE_URL = 'https://api.jobdatalake.com/v1'
const TIMEOUT_MS = 8_000

// api.jobdatalake.com - real job-board API. 1,000 free credits, 1 credit per request.
// Auth via X-API-Key header (not Bearer/Api-Key - verified directly against the live API).
export class JobDataApiProvider implements JobProvider {
  readonly name = 'jobdatalake'
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey)
  }

  private headers() {
    return { 'X-API-Key': this.apiKey }
  }

  async search(params: JobSearchParams): Promise<JobSearchResult> {
    const page = params.page ?? 1
    const perPage = Math.min(params.limit ?? 20, 100)

    const query = new URLSearchParams()
    if (params.query) query.set('q', params.query)
    if (params.location) query.set('location', params.location)
    if (params.work_mode) {
      if (params.work_mode === 'remote') query.set('remote_type', 'fully_remote')
      else if (params.work_mode === 'hybrid') query.set('remote_type', 'hybrid')
      else if (params.work_mode === 'on-site') query.set('remote_type', 'on_site')
    }
    if (params.employment_type) query.set('employment_type', params.employment_type.replace('-', '_'))
    if (params.seniority) {
      const level = seniorityToApiLevel(params.seniority)
      if (level) query.set('seniority', level)
    }
    if (params.salary_min != null) query.set('salary_min', String(Math.round(params.salary_min / 1000)))
    if (params.date_posted_days != null) {
      query.set('posted_after', String(Date.now() - params.date_posted_days * 24 * 60 * 60 * 1000))
    }
    query.set('page', String(page))
    query.set('per_page', String(perPage))

    const res = await this.fetchWithTimeout(`${BASE_URL}/jobs?${query.toString()}`)
    const data = (await res.json()) as JobDataLakeSearchResponse

    return {
      jobs: data.jobs.map(normalize),
      total: data.found,
      page: data.page,
      has_more: data.page * data.per_page < data.found,
      provider: this.name,
      is_demo: false,
    }
  }

  async getById(jobId: string): Promise<JobListing | null> {
    const res = await this.fetchWithTimeout(`${BASE_URL}/jobs/${encodeURIComponent(jobId)}`, true)
    if (res === null) return null
    const data = (await res.json()) as JobDataLakeJob
    return normalize(data)
  }

  private async fetchWithTimeout(url: string, allow404?: true): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, { headers: this.headers(), signal: controller.signal })
      if (allow404 && res.status === 404) return null as unknown as Response
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`jobdatalake returned ${res.status}: ${body.slice(0, 200)}`)
      }
      return res
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`jobdatalake timed out after ${TIMEOUT_MS}ms`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
}

function seniorityToApiLevel(s: Seniority): string | null {
  if (s === 'internship') return 'Internship'
  if (s === 'entry') return 'Entry'
  if (s === 'mid') return 'Mid Level'
  if (s === 'senior') return 'Senior'
  if (s === 'staff') return 'Staff'
  if (s === 'principal') return 'Principal'
  if (s === 'director') return 'Director'
  if (s === 'executive') return 'C Level'
  return null
}

function workModeFromApi(remoteType: string | undefined): WorkMode | null {
  if (remoteType === 'fully_remote') return 'remote'
  if (remoteType === 'hybrid') return 'hybrid'
  if (remoteType === 'on_site') return 'on-site'
  return null
}

function employmentTypeFromApi(raw: string | undefined): EmploymentType | null {
  if (raw === 'full_time') return 'full-time'
  if (raw === 'part_time') return 'part-time'
  if (raw === 'contract') return 'contract'
  if (raw === 'internship') return 'internship'
  return null
}

// API returns an array of levels (e.g. ["Mid Level", "Senior"]) - take the most senior one
function seniorityFromApi(levels: string[] | undefined): Seniority | null {
  if (!levels?.length) return null
  const order: Record<string, Seniority> = {
    'Internship': 'internship',
    'Entry': 'entry',
    'Mid Level': 'mid',
    'Senior': 'senior',
    'Staff': 'staff',
    'Lead': 'staff',
    'Principal': 'principal',
    'Manager': 'director',
    'Director': 'director',
    'C Level': 'executive',
  }
  const rank: Seniority[] = ['internship', 'entry', 'mid', 'senior', 'staff', 'principal', 'director', 'executive']
  let best: Seniority | null = null
  for (const level of levels) {
    const mapped = order[level]
    if (mapped && (!best || rank.indexOf(mapped) > rank.indexOf(best))) best = mapped
  }
  return best
}

function normalize(j: JobDataLakeJob): JobListing {
  return {
    id: crypto.randomUUID(),
    provider: 'jobdatalake',
    provider_job_id: j.id,
    source_url: j.url ?? null,
    title: j.title,
    company: j.company_name ?? 'Unknown',
    location: j.locations?.[0] ?? null,
    work_mode: workModeFromApi(j.remote_type),
    employment_type: employmentTypeFromApi(j.employment_type),
    seniority: seniorityFromApi(j.seniority),
    // API reports salary_*_usd in thousands of USD
    salary_min: j.salary_min_usd != null ? Math.round(j.salary_min_usd * 1000) : null,
    salary_max: j.salary_max_usd != null ? Math.round(j.salary_max_usd * 1000) : null,
    salary_currency: 'USD',
    description: j.description ?? null,
    structured_data: j.required_skills?.length
      ? {
          responsibilities: [],
          required_skills: j.required_skills,
          preferred_skills: [],
          experience_requirements: [],
          education_requirements: [],
          keywords: j.required_skills,
          company_info: null,
          benefits: [],
          domain: j.domain_name ?? null,
          risk_flags: [],
        }
      : null,
    posted_at: j.posted_at ? new Date(j.posted_at).toISOString() : null,
    fetched_at: new Date().toISOString(),
    expires_at: null,
  }
}

interface JobDataLakeJob {
  id: string
  title: string
  company_name?: string
  domain_name?: string | null
  url?: string | null
  job_handle?: string
  posted_at?: number | null
  locations?: string[]
  countries?: string[]
  states?: string[]
  remote_type?: string
  job_function?: string
  role?: string
  seniority?: string[]
  salary_min_usd?: number
  salary_max_usd?: number
  required_skills?: string[]
  employment_type?: string
  description?: string | null
}

interface JobDataLakeSearchResponse {
  found: number
  page: number
  per_page: number
  jobs: JobDataLakeJob[]
  stats?: { total_jobs: number; new_last_24h: number }
}
