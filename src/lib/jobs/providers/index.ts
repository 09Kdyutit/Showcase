import 'server-only'
import { FixtureProvider } from './fixture'
import { ExternalProvider } from './external'
import { JobDataApiProvider } from './jobdataapi'
import type { JobProvider, JobSearchParams, JobSearchResult } from './types'
import type { JobListing } from '@/types/database'
import { isJobsProviderEnabled } from '@/lib/feature-flags'

export { FixtureProvider } from './fixture'
export { FIXTURE_JOBS } from './fixture'
export { ExternalProvider } from './external'
export { JobDataApiProvider } from './jobdataapi'
export type { JobProvider, JobSearchParams, JobSearchResult } from './types'

function getRealProvider(): JobProvider | null {
  // Kill switch: forces fixture data immediately, without even attempting the real
  // provider  -  for an abused/misbehaving external integration during an incident.
  if (!isJobsProviderEnabled()) return null

  const jobDataApiKey = process.env.JOBDATA_API_KEY
  if (jobDataApiKey) return new JobDataApiProvider(jobDataApiKey)

  const providerName = process.env.JOBS_PROVIDER
  const apiKey = process.env.JOBS_API_KEY
  const baseUrl = process.env.JOBS_API_BASE_URL
  if (providerName && apiKey && baseUrl) return new ExternalProvider(providerName, apiKey, baseUrl)

  return null
}

// Provider resolution  -  checks env vars; falls back to fixture data in dev/demo
export function getJobProvider(): JobProvider {
  return getRealProvider() ?? new FixtureProvider()
}

// A configured real provider can still fail at request time (auth/billing issues, outages,
// rate limits)  -  never let that take down the Jobs tab. Fall back to demo data instead.
export async function searchJobs(params: JobSearchParams): Promise<JobSearchResult> {
  const real = getRealProvider()
  if (real) {
    try {
      return await real.search(params)
    } catch (err) {
      console.error('[jobs/provider] real provider search failed, falling back to fixture data:', err instanceof Error ? err.message : err)
    }
  }
  return new FixtureProvider().search(params)
}

export async function getJobById(jobId: string): Promise<JobListing | null> {
  const real = getRealProvider()
  if (real) {
    try {
      const job = await real.getById(jobId)
      if (job) return job
    } catch (err) {
      console.error('[jobs/provider] real provider getById failed, falling back to fixture data:', err instanceof Error ? err.message : err)
    }
  }
  return new FixtureProvider().getById(jobId)
}

// Look up a single job across providers
export async function resolveJob(jobId: string) {
  const provider = getJobProvider()
  return provider.getById(jobId)
}
