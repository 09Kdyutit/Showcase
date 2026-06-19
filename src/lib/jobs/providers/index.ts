import { FixtureProvider } from './fixture'
import { ExternalProvider } from './external'
import type { JobProvider } from './types'

export { FixtureProvider } from './fixture'
export { FIXTURE_JOBS } from './fixture'
export { ExternalProvider } from './external'
export type { JobProvider, JobSearchParams, JobSearchResult } from './types'

// Provider resolution — checks env vars; falls back to fixture data in dev/demo
export function getJobProvider(): JobProvider {
  const providerName = process.env.JOBS_PROVIDER
  const apiKey = process.env.JOBS_API_KEY
  const baseUrl = process.env.JOBS_API_BASE_URL

  if (providerName && apiKey && baseUrl) {
    return new ExternalProvider(providerName, apiKey, baseUrl)
  }

  return new FixtureProvider()
}

// Look up a single job across providers
export async function resolveJob(jobId: string) {
  const provider = getJobProvider()
  return provider.getById(jobId)
}
