import type { JobProvider, JobSearchParams, JobSearchResult } from './types'
import type { JobListing, StructuredJobData } from '@/types/database'

const TIMEOUT_MS = 8_000

export class ExternalProvider implements JobProvider {
  readonly name: string
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(providerName: string, apiKey: string, baseUrl: string) {
    this.name = providerName
    this.apiKey = apiKey
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.baseUrl)
  }

  async search(params: JobSearchParams): Promise<JobSearchResult> {
    const page = params.page ?? 1
    const limit = params.limit ?? 20

    const query = new URLSearchParams()
    if (params.query) query.set('q', params.query)
    if (params.location) query.set('location', params.location)
    if (params.work_mode) query.set('work_mode', params.work_mode)
    if (params.employment_type) query.set('employment_type', params.employment_type)
    if (params.seniority) query.set('seniority', params.seniority)
    if (params.salary_min != null) query.set('salary_min', String(params.salary_min))
    query.set('limit', String(limit))
    query.set('offset', String((page - 1) * limit))

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(`${this.baseUrl}/jobs/search?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Provider': this.name,
        },
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`External provider ${this.name} returned ${res.status}: ${body.slice(0, 200)}`)
      }

      const data = (await res.json()) as ExternalApiResponse
      const listings = data.jobs.map((j) => this.normalize(j))
      const deduped = deduplicateByProviderJobId(listings)

      return {
        jobs: deduped,
        total: data.total ?? deduped.length,
        page,
        has_more: data.has_more ?? false,
        provider: this.name,
        is_demo: false,
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`External provider ${this.name} timed out after ${TIMEOUT_MS}ms`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  async getById(jobId: string): Promise<JobListing | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'X-Provider': this.name,
        },
        signal: controller.signal,
      })

      if (res.status === 404) return null
      if (!res.ok) {
        throw new Error(`External provider ${this.name} returned ${res.status} for job ${jobId}`)
      }

      const data = (await res.json()) as ExternalApiJob
      return this.normalize(data)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`External provider ${this.name} timed out after ${TIMEOUT_MS}ms`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private normalize(j: ExternalApiJob): JobListing {
    return {
      id: `${this.name}::${j.id}`,
      provider: this.name,
      provider_job_id: String(j.id),
      source_url: j.url ?? null,
      title: j.title,
      company: j.company,
      location: j.location ?? null,
      work_mode: normalizeWorkMode(j.work_mode ?? j.remote),
      employment_type: normalizeEmploymentType(j.employment_type ?? j.job_type),
      seniority: normalizeSeniority(j.seniority ?? j.level ?? j.experience_level),
      salary_min: j.salary_min ?? j.compensation?.min ?? null,
      salary_max: j.salary_max ?? j.compensation?.max ?? null,
      salary_currency: j.salary_currency ?? j.compensation?.currency ?? 'USD',
      description: j.description ?? j.body ?? null,
      structured_data: extractStructuredData(j),
      posted_at: j.posted_at ?? j.created_at ?? null,
      fetched_at: new Date().toISOString(),
      expires_at: j.expires_at ?? null,
    }
  }
}

// ── Normalization helpers ──────────────────────────────────────────────────

function normalizeWorkMode(raw: string | boolean | undefined | null): JobListing['work_mode'] {
  if (raw == null) return null
  if (typeof raw === 'boolean') return raw ? 'remote' : 'on-site'
  const s = String(raw).toLowerCase()
  if (s.includes('remote')) return 'remote'
  if (s.includes('hybrid')) return 'hybrid'
  if (s.includes('on') && s.includes('site')) return 'on-site'
  if (s.includes('flexible')) return 'flexible'
  return null
}

function normalizeEmploymentType(raw: string | undefined | null): JobListing['employment_type'] {
  if (!raw) return null
  const s = raw.toLowerCase()
  if (s.includes('full')) return 'full-time'
  if (s.includes('part')) return 'part-time'
  if (s.includes('contract')) return 'contract'
  if (s.includes('freelance')) return 'freelance'
  if (s.includes('intern')) return 'internship'
  return null
}

function normalizeSeniority(raw: string | undefined | null): JobListing['seniority'] {
  if (!raw) return null
  const s = raw.toLowerCase()
  if (s.includes('intern')) return 'internship'
  if (s.includes('entry') || s.includes('junior') || s.includes('associate')) return 'entry'
  if (s.includes('mid') || s.includes('intermediate')) return 'mid'
  if (s.includes('senior') || s.includes('sr.')) return 'senior'
  if (s.includes('staff')) return 'staff'
  if (s.includes('principal') || s.includes('lead')) return 'principal'
  if (s.includes('director') || s.includes('vp') || s.includes('vice president')) return 'director'
  if (s.includes('exec') || s.includes('cto') || s.includes('cpo') || s.includes('ceo')) return 'executive'
  return null
}

function extractStructuredData(j: ExternalApiJob): StructuredJobData | null {
  if (!j.description && !j.skills) return null
  return {
    responsibilities: j.responsibilities ?? [],
    required_skills: j.skills?.required ?? j.required_skills ?? [],
    preferred_skills: j.skills?.preferred ?? j.preferred_skills ?? [],
    experience_requirements: j.requirements ?? [],
    education_requirements: j.education ?? [],
    keywords: j.tags ?? j.keywords ?? [],
    company_info: j.company_description ?? null,
    benefits: j.benefits ?? [],
    domain: j.category ?? j.domain ?? null,
    risk_flags: [],
  }
}

function deduplicateByProviderJobId(listings: JobListing[]): JobListing[] {
  const seen = new Set<string>()
  return listings.filter((l) => {
    const key = `${l.provider}::${l.provider_job_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── External API shapes (adapter layer - not all providers use the same schema) ──

interface ExternalApiCompensation {
  min?: number
  max?: number
  currency?: string
}

interface ExternalApiSkills {
  required?: string[]
  preferred?: string[]
}

interface ExternalApiJob {
  id: string | number
  title: string
  company: string
  company_description?: string
  url?: string
  location?: string
  work_mode?: string
  remote?: boolean
  employment_type?: string
  job_type?: string
  seniority?: string
  level?: string
  experience_level?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  compensation?: ExternalApiCompensation
  description?: string
  body?: string
  responsibilities?: string[]
  required_skills?: string[]
  preferred_skills?: string[]
  skills?: ExternalApiSkills
  requirements?: string[]
  education?: string[]
  tags?: string[]
  keywords?: string[]
  benefits?: string[]
  category?: string
  domain?: string
  posted_at?: string
  created_at?: string
  expires_at?: string
}

interface ExternalApiResponse {
  jobs: ExternalApiJob[]
  total?: number
  has_more?: boolean
}
