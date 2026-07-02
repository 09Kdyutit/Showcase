import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type OpportunityCategory =
  | 'hackathon' | 'ctf' | 'competition' | 'scholarship' | 'fellowship'
  | 'internship' | 'volunteering' | 'event' | 'workshop' | 'grant'
  | 'programme' | 'research' | 'job'

export interface Opportunity {
  id: string
  source: string
  category: OpportunityCategory
  title: string
  organizer: string
  url: string
  location: string | null
  is_online: boolean
  deadline_iso: string | null
  days_left: number | null
  time_left_label: string | null
  description: string | null
  tags: string[]
  prize: string | null
  is_free: boolean
  participants: number | null
  thumbnail_url: string | null
  published_at: string | null
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return diff < 0 ? null : Math.ceil(diff / 86400000)
}

function timeLabelForDays(d: number | null): string | null {
  if (d === null) return null
  if (d === 0) return 'Closes today'
  if (d === 1) return 'Closes tomorrow'
  if (d <= 3) return `${d} days left`
  if (d <= 7) return `${d} days left`
  if (d <= 14) return 'About 2 weeks left'
  if (d <= 31) return 'About a month left'
  const m = Math.round(d / 30)
  return `About ${m} month${m > 1 ? 's' : ''} left`
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#8211;/g, '-')
    .replace(/&#038;/g, '&').replace(/\s+/g, ' ').trim()
}

function parseDevpostDeadline(raw: string | undefined): string | null {
  if (!raw) return null
  const parts = raw.split(' - ')
  const end = parts[parts.length - 1].trim()
  const d = new Date(end)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function extractDeadlineFromText(text: string): string | null {
  const m = text.match(/[Dd]eadline[:\s]+([A-Za-z]+ \d{1,2},?\s+\d{4})/i)
    ?? text.match(/[Cc]losing [Dd]ate[:\s]+([A-Za-z]+ \d{1,2},?\s+\d{4})/i)
    ?? text.match(/[Aa]pplication [Dd]eadline[:\s]+([A-Za-z]+ \d{1,2},?\s+\d{4})/i)
  if (!m) return null
  const d = new Date(m[1])
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function parseMmDdYyyy(s: string): string | null {
  if (!s) return null
  const [mm, dd, yyyy] = s.split('/')
  if (!mm || !dd || !yyyy) return null
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  return isNaN(d.getTime()) ? null : d.toISOString()
}

async function cachedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      'User-Agent': 'Showcase-App/1.0',
      ...init?.headers,
    },
    next: { revalidate: 86400 },
  })
}

// ── Devpost hackathons ────────────────────────────────────────────────────────

async function fetchDevpost(): Promise<Opportunity[]> {
  const pages = await Promise.allSettled([
    cachedFetch('https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&per_page=50&page=1&order_by=deadline&order_direction=asc'),
    cachedFetch('https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&per_page=50&page=2&order_by=deadline&order_direction=asc'),
    cachedFetch('https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&per_page=50&page=3&order_by=deadline&order_direction=asc'),
    cachedFetch('https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&per_page=50&page=4&order_by=deadline&order_direction=asc'),
  ])

  const hackathons: Opportunity[] = []

  for (const r of pages) {
    if (r.status !== 'fulfilled' || !r.value.ok) continue
    try {
      const data = await r.value.json() as {
        hackathons?: Array<{
          id: number; title: string; organization_name?: string; url: string
          displayed_location?: { icon: string; location: string }
          submission_period_dates?: string; time_left_to_submission?: string
          themes?: Array<{ name: string }>; prize_amount?: string
          registrations_count?: number; thumbnail_url?: string; open_state?: string
        }>
      }
      for (const h of data.hackathons ?? []) {
        const locStr = h.displayed_location?.location ?? null
        const isOnline = h.displayed_location?.icon === 'globe' || !locStr || locStr.toLowerCase().includes('online')
        const deadlineIso = parseDevpostDeadline(h.submission_period_dates)
        const days = daysLeft(deadlineIso)
        const titleLower = h.title.toLowerCase()
        const isCompetition = titleLower.includes('challenge') || titleLower.includes('competition')
          || titleLower.includes('contest') || titleLower.includes('prize')
        hackathons.push({
          id: `devpost-${h.id}`,
          source: 'devpost',
          category: isCompetition ? 'competition' : 'hackathon',
          title: h.title,
          organizer: h.organization_name ?? 'Devpost',
          url: h.url,
          location: isOnline ? 'Online' : locStr,
          is_online: Boolean(isOnline),
          deadline_iso: deadlineIso,
          days_left: days,
          time_left_label: h.time_left_to_submission ?? timeLabelForDays(days),
          description: null,
          tags: (h.themes ?? []).map(t => t.name).slice(0, 5),
          prize: h.prize_amount ? stripHtml(h.prize_amount) : null,
          is_free: true,
          participants: h.registrations_count ?? null,
          thumbnail_url: h.thumbnail_url ? `https:${h.thumbnail_url}` : null,
          published_at: null,
        })
      }
    } catch { /* skip bad page */ }
  }

  return hackathons
}

// ── CTFtime ───────────────────────────────────────────────────────────────────

async function fetchCtftime(): Promise<Opportunity[]> {
  const now = Math.floor(Date.now() / 1000)
  type CtfEvent = {
    id: number; title: string; organizers?: Array<{ name: string }>
    url: string; ctftime_url: string; location?: string; onsite?: boolean
    start?: string; finish?: string; format?: string; tags?: string[]
  }
  const toOpp = (e: CtfEvent, isPractice: boolean): Opportunity => {
    const days = isPractice ? null : daysLeft(e.finish ?? null)
    return {
      id: `ctftime-${e.id}`,
      source: 'ctftime',
      category: 'ctf' as const,
      title: e.title,
      organizer: e.organizers?.[0]?.name ?? 'CTFtime',
      url: e.url || e.ctftime_url,
      location: e.onsite ? (e.location ?? 'On-site') : 'Online',
      is_online: !e.onsite,
      deadline_iso: isPractice ? null : (e.finish ?? null),
      days_left: days,
      time_left_label: isPractice ? 'Practice available' : timeLabelForDays(days),
      description: e.format ? `${e.format} format CTF${isPractice ? ' — challenges still available to practice' : ''}` : null,
      tags: e.tags ?? [],
      prize: null,
      is_free: true,
      participants: null,
      thumbnail_url: null,
      published_at: e.start ?? null,
    }
  }

  const res = await cachedFetch(
    `https://ctftime.org/api/v1/events/?limit=200&start=${now}&finish=${now + 365 * 86400}`,
    { headers: { Accept: 'application/json' } }
  ).then(r => r.ok ? r.json() as Promise<CtfEvent[]> : []).catch(() => [])

  return res.map(e => toOpp(e, false))
}

// ── Coding competitions (Codeforces, LeetCode, CodeChef) ─────────────────────

async function fetchCodingContests(): Promise<Opportunity[]> {
  const now = Date.now()

  const [cfRes, lcRes, ccRes] = await Promise.allSettled([
    // Codeforces — all contests (upcoming + past 180 days)
    cachedFetch('https://codeforces.com/api/contest.list?gym=false')
      .then(r => r.ok ? r.json() : { result: [] }).catch(() => ({ result: [] })),

    // LeetCode — all contests via GraphQL
    cachedFetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ allContests { title startTime duration } }' }),
    } as RequestInit).then(r => r.ok ? r.json() : { data: { allContests: [] } }).catch(() => ({ data: { allContests: [] } })),

    // CodeChef — upcoming + present
    cachedFetch('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all&page=0&limit=20')
      .then(r => r.ok ? r.json() : {}).catch(() => ({})),
  ])

  const opps: Opportunity[] = []

  // Codeforces
  if (cfRes.status === 'fulfilled') {
    const contests = (cfRes.value.result ?? []) as Array<{
      id: number; name: string; type: string; phase: string
      startTimeSeconds: number; durationSeconds: number
    }>
    for (const c of contests) {
      const isActive = c.phase === 'BEFORE' || c.phase === 'CODING'
      if (!isActive) continue
      const startMs = c.startTimeSeconds * 1000
      const endMs = (c.startTimeSeconds + c.durationSeconds) * 1000
      const deadlineIso = new Date(endMs).toISOString()
      const days = daysLeft(deadlineIso)
      opps.push({
        id: `cf-${c.id}`,
        source: 'codeforces',
        category: 'competition',
        title: c.name,
        organizer: 'Codeforces',
        url: `https://codeforces.com/contest/${c.id}`,
        location: 'Online',
        is_online: true,
        deadline_iso: deadlineIso,
        days_left: days,
        time_left_label: timeLabelForDays(days),
        description: `${c.type} competitive programming contest on Codeforces. Register now to compete.`,
        tags: ['competitive programming', 'algorithms', c.type.toLowerCase()],
        prize: null,
        is_free: true,
        participants: null,
        thumbnail_url: null,
        published_at: new Date(startMs).toISOString(),
      })
    }
  }

  // LeetCode
  if (lcRes.status === 'fulfilled') {
    const contests = (lcRes.value.data?.allContests ?? []) as Array<{
      title: string; startTime: number; duration: number
    }>
    for (const c of contests) {
      const startMs = c.startTime * 1000
      if (startMs <= now) continue // only upcoming
      const endMs = startMs + c.duration * 1000
      const deadlineIso = new Date(endMs).toISOString()
      const days = daysLeft(deadlineIso)
      const slug = c.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      opps.push({
        id: `lc-${slug}`,
        source: 'leetcode',
        category: 'competition',
        title: c.title,
        organizer: 'LeetCode',
        url: `https://leetcode.com/contest/${slug}/`,
        location: 'Online',
        is_online: true,
        deadline_iso: deadlineIso,
        days_left: days,
        time_left_label: timeLabelForDays(days),
        description: 'Competitive programming contest on LeetCode — solve algorithmic problems in 90 minutes.',
        tags: ['competitive programming', 'algorithms', 'data structures'],
        prize: null,
        is_free: true,
        participants: null,
        thumbnail_url: null,
        published_at: new Date(startMs).toISOString(),
      })
    }
  }

  // CodeChef
  if (ccRes.status === 'fulfilled') {
    const cc = ccRes.value as {
      present_contests?: Array<{ contest_code: string; contest_name: string; contest_end_date_iso: string; contest_start_date_iso: string }>
      future_contests?: Array<{ contest_code: string; contest_name: string; contest_end_date_iso: string; contest_start_date_iso: string }>
    }
    for (const c of [...(cc.present_contests ?? []), ...(cc.future_contests ?? [])]) {
      const endMs = new Date(c.contest_end_date_iso).getTime()
      const days = daysLeft(new Date(endMs).toISOString())
      opps.push({
        id: `cc-${c.contest_code}`,
        source: 'codechef',
        category: 'competition',
        title: c.contest_name,
        organizer: 'CodeChef',
        url: `https://www.codechef.com/${c.contest_code}`,
        location: 'Online',
        is_online: true,
        deadline_iso: new Date(endMs).toISOString(),
        days_left: days,
        time_left_label: timeLabelForDays(days),
        description: 'Competitive programming contest on CodeChef.',
        tags: ['competitive programming', 'algorithms'],
        prize: null,
        is_free: true,
        participants: null,
        thumbnail_url: null,
        published_at: c.contest_start_date_iso,
      })
    }
  }

  return opps
}

// ── Jobdatalake internships (raw API, multi-page) ────────────────────────────

interface RawJdlJob {
  id: string; title: string; company_name: string; domain_name?: string
  url: string; job_handle: string; posted_at: number; locations?: string[]
  countries?: string[]; remote_type?: string | null; job_function?: string
  required_skills?: string[]; salary_min_usd?: number; salary_max_usd?: number
  employment_type?: string; seniority?: string[]
}

async function fetchInternshipsPage(apiKey: string, page: number): Promise<RawJdlJob[]> {
  try {
    const res = await fetch(
      `https://api.jobdatalake.com/v1/jobs?seniority=Internship&per_page=100&page=${page}`,
      { headers: { 'X-API-Key': apiKey }, next: { revalidate: 86400 } }
    )
    if (!res.ok) return []
    const d = await res.json() as { jobs: RawJdlJob[] }
    return d.jobs ?? []
  } catch { return [] }
}

function jdlJobToOpportunity(j: RawJdlJob): Opportunity {
  const loc = j.locations?.[0] ?? null
  const isRemote = j.remote_type === 'remote' || j.remote_type === 'fully_remote'
  const postedMs = j.posted_at > 1e12 ? j.posted_at : j.posted_at * 1000
  const salary = (j.salary_min_usd && j.salary_max_usd)
    ? `$${j.salary_min_usd}–$${j.salary_max_usd}/hr`
    : j.salary_min_usd ? `$${j.salary_min_usd}+/hr` : null

  return {
    id: `jdl-${j.id}`,
    source: 'jobdatalake',
    category: 'internship',
    title: j.title,
    organizer: j.company_name ?? j.domain_name ?? 'Company',
    url: j.url || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(j.title)}`,
    location: isRemote ? 'Remote' : loc,
    is_online: isRemote,
    deadline_iso: null,
    days_left: null,
    time_left_label: null,
    description: salary ? `Compensation: ${salary}` : null,
    tags: (j.required_skills ?? []).slice(0, 5),
    prize: salary,
    is_free: true,
    participants: null,
    thumbnail_url: null,
    published_at: postedMs ? new Date(postedMs).toISOString() : null,
  }
}

async function fetchInternships(apiKey: string): Promise<Opportunity[]> {
  // Fetch 8 pages × 100 = 800 internships concurrently
  const pages = await Promise.allSettled(
    [1, 2, 3, 4, 5, 6, 7, 8].map(p => fetchInternshipsPage(apiKey, p))
  )
  return pages
    .filter((r): r is PromiseFulfilledResult<RawJdlJob[]> => r.status === 'fulfilled')
    .flatMap(r => r.value.map(jdlJobToOpportunity))
}

// ── Grants.gov ────────────────────────────────────────────────────────────────

interface GrantsGovHit {
  id: string | number; title: string; agencyName?: string; number?: string
  openDate?: string; closeDate?: string; awardCeiling?: number | null; awardFloor?: number | null
  eligibleApplicants?: string; synopsis?: string
}

async function grantsGovSearch(keyword: string, rows: number, startRecordNum = 0): Promise<GrantsGovHit[]> {
  try {
    const body: Record<string, unknown> = { oppStatuses: 'posted', rows, sortBy: 'openDate|desc', startRecordNum }
    if (keyword) body.keyword = keyword
    const res = await fetch('https://apply07.grants.gov/grantsws/rest/opportunities/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Showcase-App/1.0' },
      body: JSON.stringify(body),
      next: { revalidate: 86400 },
    })
    if (!res.ok) return []
    const d = await res.json() as { oppHits?: GrantsGovHit[] }
    return d.oppHits ?? []
  } catch { return [] }
}

function classifyGrant(title: string): OpportunityCategory {
  const t = title.toLowerCase()
  if (t.includes('scholarship') || t.includes('tuition') || t.includes('student award')) return 'scholarship'
  if (t.includes('fellowship') || t.includes('traineeship') || t.includes('postdoctoral')) return 'fellowship'
  if (t.includes('research') || t.includes('r01') || t.includes('r21') || t.includes('r03') || t.includes('scientific')) return 'research'
  if (t.includes('training') || t.includes('workshop') || t.includes('curriculum')) return 'workshop'
  if (t.includes('conference') || t.includes('symposium') || t.includes('summit')) return 'event'
  if (t.includes('volunteer') || t.includes('americorps') || t.includes('community service')) return 'volunteering'
  if (t.includes('competition') || t.includes('prize') || t.includes('challenge') || t.includes('contest')) return 'competition'
  if (t.includes('program') || t.includes('initiative') || t.includes('exchange') || t.includes('cooperative')) return 'programme'
  return 'grant'
}

function grantsGovToOpportunity(hit: GrantsGovHit, forceCategory?: OpportunityCategory): Opportunity {
  const closeIso = parseMmDdYyyy(hit.closeDate ?? '')
  const openIso = parseMmDdYyyy(hit.openDate ?? '')
  const days = daysLeft(closeIso)
  const ceiling = hit.awardCeiling ? `Up to $${Number(hit.awardCeiling).toLocaleString()}` : null
  const floor = hit.awardFloor ? `From $${Number(hit.awardFloor).toLocaleString()}` : null
  const category = forceCategory ?? classifyGrant(hit.title ?? '')
  return {
    id: `grants-${hit.id ?? hit.number}`,
    source: 'grantsgov',
    category,
    title: stripHtml(hit.title ?? '').replace(/\s+/g, ' ').trim(),
    organizer: hit.agencyName ? stripHtml(hit.agencyName) : 'U.S. Government',
    url: `https://www.grants.gov/search-results-detail/${hit.id}`,
    location: 'United States',
    is_online: false,
    deadline_iso: closeIso,
    days_left: days,
    time_left_label: timeLabelForDays(days),
    description: hit.synopsis ? stripHtml(hit.synopsis).slice(0, 280) : null,
    tags: hit.eligibleApplicants ? [hit.eligibleApplicants] : [],
    prize: ceiling ?? floor ?? null,
    is_free: true,
    participants: null,
    thumbnail_url: null,
    published_at: openIso,
  }
}

// Grants.gov is US-government only, so we keep it intentionally small — it is one
// source among many, not the whole feed. We prioritise the genuinely useful,
// well-categorised slices (scholarships, fellowships, competitions, volunteering)
// and cap the total so it can never dominate the global mix.
const GRANTSGOV_CAP = 250

async function fetchAllGrantsGov(): Promise<Opportunity[]> {
  const fetches = await Promise.allSettled([
    // ── General: a light sample for auto-classification (2 pages) ───────────
    grantsGovSearch('', 150, 0),       // idx 0
    grantsGovSearch('', 150, 150),     // idx 1

    // ── Categorised keyword slices (the most useful US opportunities) ───────
    grantsGovSearch('scholarship student', 100),        // idx 2 → scholarship
    grantsGovSearch('fellowship', 100),                 // idx 3 → fellowship
    grantsGovSearch('postdoctoral graduate', 60),       // idx 4 → fellowship
    grantsGovSearch('training workshop', 80),           // idx 5 → workshop
    grantsGovSearch('prize competition challenge', 80), // idx 6 → competition
    grantsGovSearch('volunteer community service', 60), // idx 7 → volunteering
  ])

  const KEYWORD_CATEGORY_MAP: Record<number, OpportunityCategory | undefined> = {
    2: 'scholarship',
    3: 'fellowship',
    4: 'fellowship',
    5: 'workshop',
    6: 'competition',
    7: 'volunteering',
  }

  const seen = new Set<string>()
  const all: Opportunity[] = []

  // Process categorised keyword searches FIRST (indices 2-7) so their forced
  // categories take priority, then fill in from the general sample (0-1).
  const order = [2, 3, 4, 5, 6, 7, 0, 1]
  for (const idx of order) {
    const result = fetches[idx]
    if (result.status !== 'fulfilled') continue
    const forceCategory = KEYWORD_CATEGORY_MAP[idx]
    for (const hit of result.value) {
      const id = String(hit.id ?? hit.number)
      if (seen.has(id)) continue
      seen.add(id)
      all.push(grantsGovToOpportunity(hit, forceCategory))
    }
  }

  return all.slice(0, GRANTSGOV_CAP)
}

// ── Tech Conferences (events) ────────────────────────────────────────────────

const CONF_CATEGORIES = [
  'accessibility','android','api','css','data','devops','dotnet','general',
  'graphql','ios','iot','java','javascript','kotlin','leadership','networking',
  'opensource','performance','php','product','python','rust','security',
  'sre','testing','typescript','ux',
]

interface ConfEntry {
  name: string; url: string; startDate: string; endDate?: string
  city?: string; country?: string; online?: boolean; locales?: string
  cfpUrl?: string; cfpEndDate?: string
}

async function fetchConferences(): Promise<Opportunity[]> {
  const BASE = 'https://raw.githubusercontent.com/tech-conferences/conference-data/master/conferences/2026/'
  const results = await Promise.allSettled(
    CONF_CATEGORIES.map(cat =>
      cachedFetch(BASE + cat + '.json')
        .then(r => r.ok ? r.json() as Promise<ConfEntry[]> : [])
        .catch(() => [])
    )
  )
  const opps: Opportunity[] = []
  const seen = new Set<string>()
  const now = Date.now()

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const conf of r.value) {
      if (!conf.name || !conf.url || seen.has(conf.url)) continue
      // Skip past events
      const endMs = conf.endDate ? new Date(conf.endDate).getTime() : new Date(conf.startDate).getTime()
      if (endMs < now) continue
      seen.add(conf.url)
      const deadlineIso = conf.endDate ? new Date(conf.endDate).toISOString() : new Date(conf.startDate).toISOString()
      const days = daysLeft(deadlineIso)
      const loc = conf.online
        ? 'Online'
        : [conf.city, conf.country].filter(Boolean).join(', ') || null
      opps.push({
        id: `conf-${Buffer.from(conf.url).toString('base64').slice(0, 16)}`,
        source: 'tech-conferences',
        category: 'event',
        title: conf.name,
        organizer: conf.city ? `${conf.city} Conference` : 'Tech Conference',
        url: conf.url,
        location: loc,
        is_online: Boolean(conf.online),
        deadline_iso: deadlineIso,
        days_left: days,
        time_left_label: timeLabelForDays(days),
        description: conf.cfpUrl ? 'Call for proposals open — submit your talk.' : null,
        tags: [],
        prize: null,
        is_free: false,
        participants: null,
        thumbnail_url: null,
        published_at: new Date(conf.startDate).toISOString(),
      })
    }
  }
  return opps
}

// ── Grand Challenge (AI/medical imaging competitions, always-open) ────────────

async function fetchGrandChallenge(): Promise<Opportunity[]> {
  const pages = await Promise.allSettled(
    [1, 2, 3].map(page =>
      cachedFetch(`https://grand-challenge.org/api/v1/challenges/?page_size=100&page=${page}`, {
        headers: { Accept: 'application/json' },
      }).then(r => r.ok ? r.json() as Promise<{
        results: Array<{
          slug: string; title: string; description: string; url: string
          status: string; logo?: string; start_date?: string; end_date?: string; incentives?: string
        }>
      }> : { results: [] }).catch(() => ({ results: [] }))
    )
  )

  return pages
    .filter((r): r is PromiseFulfilledResult<{ results: Array<{ slug: string; title: string; description: string; url: string; status: string; logo?: string; start_date?: string; end_date?: string; incentives?: string }> }> => r.status === 'fulfilled')
    .flatMap(r => r.value.results)
    .filter(c => c.status === 'OPEN')
    .map(c => {
      const deadlineIso = c.end_date ? new Date(c.end_date).toISOString() : null
      const days = daysLeft(deadlineIso)
      return {
        id: `gc-${c.slug}`,
        source: 'grand-challenge',
        category: 'competition' as const,
        title: c.title || c.slug,
        organizer: 'Grand Challenge',
        url: c.url,
        location: 'Online',
        is_online: true,
        deadline_iso: deadlineIso,
        days_left: days,
        time_left_label: deadlineIso ? timeLabelForDays(days) : 'Open submission',
        description: c.description ? stripHtml(c.description).slice(0, 280) : 'Medical imaging and AI challenge — open for submissions.',
        tags: ['AI', 'machine learning', 'medical imaging', 'research'],
        prize: c.incentives ? stripHtml(c.incentives).slice(0, 100) : null,
        is_free: true,
        participants: null,
        thumbnail_url: c.logo ?? null,
        published_at: c.start_date ? new Date(c.start_date).toISOString() : null,
      }
    })
}

// ── Zooniverse citizen science (volunteering) ─────────────────────────────────

interface ZooniverseProject {
  id: number; display_name: string; description?: string; slug: string
  classifiers_count?: number; subjects_count?: number; state?: string
}

async function fetchZooniverse(): Promise<Opportunity[]> {
  // Fetch live projects (state=live) sorted by volunteer count — most popular first
  const pages = await Promise.allSettled(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(page =>
      cachedFetch(
        `https://www.zooniverse.org/api/projects?page_size=100&page=${page}&state=live&sort=-classifiers_count`,
        { headers: { Accept: 'application/vnd.api+json; version=1' } }
      ).then(r => r.ok ? r.json() as Promise<{ projects: ZooniverseProject[] }> : { projects: [] })
       .catch(() => ({ projects: [] }))
    )
  )

  return pages
    .filter((r): r is PromiseFulfilledResult<{ projects: ZooniverseProject[] }> => r.status === 'fulfilled')
    .flatMap(r => r.value.projects)
    .map(p => ({
      id: `zoo-${p.id}`,
      source: 'zooniverse',
      category: 'volunteering' as const,
      title: p.display_name,
      organizer: 'Zooniverse',
      url: `https://www.zooniverse.org/projects/${p.slug}`,
      location: 'Online',
      is_online: true,
      deadline_iso: null,
      days_left: null,
      time_left_label: 'Ongoing',
      description: p.description?.slice(0, 280) ?? null,
      tags: ['citizen science', 'research', 'online volunteering'],
      prize: null,
      is_free: true,
      participants: p.classifiers_count ?? null,
      thumbnail_url: null,
      published_at: null,
    }))
}

// ── Opportunity Desk (global scholarships, fellowships, grants worldwide) ─────
// OD's per-category feeds return empty, so we read the main feed (which paginates)
// and classify each post by its own category tags. OD posts are tagged by region
// — Africa, Asia, Europe, India, Kenya, Nigeria, etc. — which is exactly the
// worldwide coverage we want.

const OD_GEO = [
  'International', 'Global', 'Worldwide', 'Africa', 'Asia', 'Europe', 'Americas',
  'North America', 'South America', 'Middle East', 'Oceania', 'Caribbean',
  'Nigeria', 'Kenya', 'Ghana', 'South Africa', 'Uganda', 'Egypt', 'Ethiopia', 'Rwanda',
  'India', 'Pakistan', 'Bangladesh', 'Indonesia', 'Philippines', 'Nepal', 'Sri Lanka',
  'United States', 'USA', 'United Kingdom', 'UK', 'Canada', 'Australia',
  'Germany', 'France', 'Netherlands', 'Italy', 'Spain', 'China', 'Japan', 'Brazil',
]

function classifyOdItem(cats: string[], title: string): OpportunityCategory {
  const hay = `${cats.join(' ')} ${title}`.toLowerCase()
  if (hay.includes('scholarship')) return 'scholarship'
  if (hay.includes('fellowship')) return 'fellowship'
  if (hay.includes('internship') || hay.includes(' intern')) return 'internship'
  if (hay.includes('volunteer')) return 'volunteering'
  if (hay.includes('competition') || hay.includes('contest') || hay.includes('award') || hay.includes('prize') || hay.includes('challenge')) return 'competition'
  if (hay.includes('conference') || hay.includes('summit') || hay.includes('forum')) return 'event'
  if (hay.includes('workshop') || hay.includes('training') || hay.includes('bootcamp')) return 'workshop'
  if (hay.includes('grant') || hay.includes('funding')) return 'grant'
  if (hay.includes('research')) return 'research'
  if (hay.includes('hot job') || hay.includes('vacanc') || hay.includes('hiring') || hay.includes(' job')) return 'job'
  return 'programme'
}

function odLocation(cats: string[]): string {
  const geo = cats.filter(c => OD_GEO.some(g => g.toLowerCase() === c.toLowerCase()))
  if (geo.length === 0) return 'Global'
  // Prefer specific countries over continents when both are present
  const specific = geo.find(g => !['International', 'Global', 'Worldwide', 'Africa', 'Asia', 'Europe', 'Americas', 'North America', 'South America', 'Middle East', 'Oceania', 'Caribbean'].includes(g))
  return specific ?? geo[0]
}

function parseOdFeed(xml: string): Opportunity[] {
  const items: Opportunity[] = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1]
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? block.match(/<title>(.*?)<\/title>/))?.[1]?.trim()
    const link = block.match(/<link>(https?:\/\/[^<]+)<\/link>/)?.[1]?.trim()
    const desc = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ?? block.match(/<description>([\s\S]*?)<\/description>/))?.[1]
    const pub = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]
    if (!title || !link) continue
    const cats: string[] = []
    for (const cm of block.matchAll(/<category><!\[CDATA\[(.*?)\]\]><\/category>/g)) cats.push(cm[1])
    const cleanDesc = desc ? stripHtml(desc) : null
    const deadlineIso = cleanDesc ? extractDeadlineFromText(cleanDesc) : null
    const days = daysLeft(deadlineIso)
    items.push({
      id: `od-${Buffer.from(link).toString('base64').slice(0, 16)}`,
      source: 'opportunitydesk',
      category: classifyOdItem(cats, title),
      title: stripHtml(title),
      organizer: 'Opportunity Desk',
      url: link,
      location: odLocation(cats),
      is_online: false,
      deadline_iso: deadlineIso, days_left: days, time_left_label: timeLabelForDays(days),
      description: cleanDesc?.slice(0, 280) ?? null,
      tags: cats.filter(c => !['Our Blog', 'Youth', 'Hot Jobs', 'Opportunities'].includes(c)).slice(0, 5),
      prize: null, is_free: true, participants: null, thumbnail_url: null,
      published_at: pub ? new Date(pub).toISOString() : null,
    })
  }
  return items
}

async function fetchOdFeeds(): Promise<Opportunity[]> {
  const urls = [
    'https://opportunitydesk.org/feed/',
    ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => `https://opportunitydesk.org/feed/?paged=${p}`),
  ]
  const results = await Promise.allSettled(
    urls.map(async url => {
      const res = await cachedFetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShowcaseBot/1.0; +https://showcase.app)' },
      })
      if (!res.ok) return []
      const xml = await res.text()
      if (!xml.includes('<item>')) return []
      return parseOdFeed(xml)
    })
  )
  const all = results
    .filter((r): r is PromiseFulfilledResult<Opportunity[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
  // Dedup within OD (pages can overlap)
  const seen = new Set<string>()
  return all.filter(o => {
    if (seen.has(o.url)) return false
    seen.add(o.url)
    return true
  })
}

// ── Global remote jobs & internships (no API key, worldwide) ──────────────────

function jobCategory(title: string, type?: string): OpportunityCategory {
  const t = `${title} ${type ?? ''}`.toLowerCase()
  if (t.includes('intern') || t.includes('internship') || t.includes('trainee') || t.includes('apprentice')) return 'internship'
  return 'job'
}

// Remotive — curated remote jobs, open to candidates worldwide
async function fetchRemotive(): Promise<Opportunity[]> {
  try {
    const res = await cachedFetch('https://remotive.com/api/remote-jobs?limit=200', { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json() as {
      jobs?: Array<{
        id: number; url: string; title: string; company_name: string; category?: string
        tags?: string[]; job_type?: string; publication_date?: string
        candidate_required_location?: string; salary?: string; description?: string
      }>
    }
    return (data.jobs ?? []).map(j => ({
      id: `remotive-${j.id}`,
      source: 'remotive',
      category: jobCategory(j.title, j.job_type),
      title: j.title,
      organizer: j.company_name || 'Remotive',
      url: j.url,
      location: j.candidate_required_location?.trim() || 'Remote · Worldwide',
      is_online: true,
      deadline_iso: null,
      days_left: null,
      time_left_label: 'Apply now',
      description: j.description ? stripHtml(j.description).slice(0, 280) : null,
      tags: [j.category, ...(j.tags ?? [])].filter(Boolean).slice(0, 5) as string[],
      prize: j.salary?.trim() || null,
      is_free: true,
      participants: null,
      thumbnail_url: null,
      published_at: j.publication_date ?? null,
    }))
  } catch { return [] }
}

// Arbeitnow — European + remote job board, open API
async function fetchArbeitnow(): Promise<Opportunity[]> {
  try {
    const pages = await Promise.allSettled([
      cachedFetch('https://www.arbeitnow.com/api/job-board-api', { headers: { Accept: 'application/json' } }),
      cachedFetch('https://www.arbeitnow.com/api/job-board-api?page=2', { headers: { Accept: 'application/json' } }),
    ])
    const opps: Opportunity[] = []
    for (const p of pages) {
      if (p.status !== 'fulfilled' || !p.value.ok) continue
      const data = await p.value.json() as {
        data?: Array<{
          slug: string; company_name: string; title: string; description?: string
          remote?: boolean; url: string; tags?: string[]; job_types?: string[]
          location?: string; created_at?: number
        }>
      }
      for (const j of data.data ?? []) {
        opps.push({
          id: `arbeitnow-${j.slug}`,
          source: 'arbeitnow',
          category: jobCategory(j.title, (j.job_types ?? []).join(' ')),
          title: j.title,
          organizer: j.company_name || 'Arbeitnow',
          url: j.url,
          location: j.remote ? (j.location ? `${j.location} · Remote` : 'Remote') : (j.location || null),
          is_online: Boolean(j.remote),
          deadline_iso: null,
          days_left: null,
          time_left_label: 'Apply now',
          description: j.description ? stripHtml(j.description).slice(0, 280) : null,
          tags: (j.tags ?? []).slice(0, 5),
          prize: null,
          is_free: true,
          participants: null,
          thumbnail_url: null,
          published_at: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
        })
      }
    }
    return opps
  } catch { return [] }
}

// RemoteOK — global remote jobs (first array element is metadata, skipped)
async function fetchRemoteOk(): Promise<Opportunity[]> {
  try {
    const res = await cachedFetch('https://remoteok.com/api', { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json() as Array<{
      id?: string; slug?: string; position?: string; company?: string; tags?: string[]
      location?: string; url?: string; date?: string; description?: string
    }>
    return data
      .filter(j => j.position && j.company)
      .map(j => ({
        id: `remoteok-${j.id ?? j.slug}`,
        source: 'remoteok',
        category: jobCategory(j.position ?? '', ''),
        title: j.position as string,
        organizer: j.company as string,
        url: j.url || `https://remoteok.com/remote-jobs/${j.slug}`,
        location: j.location?.trim() || 'Remote · Worldwide',
        is_online: true,
        deadline_iso: null,
        days_left: null,
        time_left_label: 'Apply now',
        description: j.description ? stripHtml(j.description).slice(0, 280) : null,
        tags: (j.tags ?? []).slice(0, 5),
        prize: null,
        is_free: true,
        participants: null,
        thumbnail_url: null,
        published_at: j.date ?? null,
      }))
  } catch { return [] }
}

// ── Shared aggregation ────────────────────────────────────────────────────────

// Sort within a source: soonest deadline first, then freshest published.
function urgencyThenFresh(a: Opportunity, b: Opportunity): number {
  if (a.days_left !== null && b.days_left !== null) return a.days_left - b.days_left
  if (a.days_left !== null) return -1
  if (b.days_left !== null) return 1
  const ad = a.published_at ? new Date(a.published_at).getTime() : 0
  const bd = b.published_at ? new Date(b.published_at).getTime() : 0
  return bd - ad
}

// Round-robin interleave by source so no single provider (e.g. US grants) floods
// the top of the feed. Each source contributes its most urgent item per round.
function diversify(opps: Opportunity[]): Opportunity[] {
  const groups = new Map<string, Opportunity[]>()
  for (const o of opps) {
    const arr = groups.get(o.source)
    if (arr) arr.push(o)
    else groups.set(o.source, [o])
  }
  for (const arr of groups.values()) arr.sort(urgencyThenFresh)
  const lists = [...groups.values()]
  const result: Opportunity[] = []
  for (let i = 0; result.length < opps.length; i++) {
    let progressed = false
    for (const arr of lists) {
      if (i < arr.length) {
        result.push(arr[i])
        progressed = true
      }
    }
    if (!progressed) break
  }
  return result
}

export async function fetchAllOpportunities(): Promise<Opportunity[]> {
  const apiKey = process.env.JOBDATA_API_KEY ?? ''

  const results = await Promise.allSettled([
    fetchDevpost(),
    fetchCtftime(),
    apiKey ? fetchInternships(apiKey) : Promise.resolve([]),
    fetchAllGrantsGov(),
    fetchConferences(),
    fetchZooniverse(),
    fetchCodingContests(),
    fetchGrandChallenge(),
    fetchOdFeeds(),     // global scholarships/fellowships (Africa, Asia, LatAm, EU)
    fetchRemotive(),    // global remote jobs & internships
    fetchArbeitnow(),   // EU + remote jobs
    fetchRemoteOk(),    // global remote jobs
  ])

  const merged: Opportunity[] = results
    .filter((r): r is PromiseFulfilledResult<Opportunity[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  // Deduplicate by URL
  const seen = new Set<string>()
  return merged.filter(o => {
    if (!o.url || seen.has(o.url)) return false
    seen.add(o.url)
    return true
  })
}

// ── Request handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query') ?? ''
    const category = searchParams.get('category') ?? ''

    // Auto-detect region from resume
    let region = searchParams.get('region') ?? ''
    if (!region) {
      const { data: resumes } = await supabase
        .from('resumes').select('parsed_json')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const parsed = resumes?.[0]?.parsed_json as { location?: string } | null
      region = (parsed?.location ?? '').split(',')[0].trim()
    }

    let all = await fetchAllOpportunities()

    // Build counts before filtering
    const counts: Partial<Record<OpportunityCategory | 'all', number>> = { all: all.length }
    for (const o of all) {
      counts[o.category] = (counts[o.category] ?? 0) + 1
    }

    // Text search filter
    if (query) {
      const q = query.toLowerCase()
      all = all.filter(o =>
        o.title.toLowerCase().includes(q) ||
        o.organizer.toLowerCase().includes(q) ||
        (o.description?.toLowerCase().includes(q) ?? false) ||
        o.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    // Category filter
    if (category) {
      all = all.filter(o => o.category === category)
    }

    // Interleave by source so the feed shows variety (jobs, hackathons,
    // scholarships, CTFs, fellowships…) instead of a wall of one provider.
    all = diversify(all)

    return NextResponse.json({ data: all, region, total: all.length, counts })
  } catch (err) {
    console.error('[opportunities/search]', err)
    return NextResponse.json({ error: 'Failed to load opportunities' }, { status: 500 })
  }
}
