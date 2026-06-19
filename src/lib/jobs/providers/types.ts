import type { JobListing, WorkMode, EmploymentType, Seniority } from '@/types/database'

export interface JobSearchParams {
  query?: string
  location?: string
  work_mode?: WorkMode | ''
  employment_type?: EmploymentType | ''
  seniority?: Seniority | ''
  salary_min?: number
  salary_max?: number
  date_posted_days?: number
  page?: number
  limit?: number
}

export interface JobSearchResult {
  jobs: JobListing[]
  total: number
  page: number
  has_more: boolean
  provider: string
  is_demo: boolean
}

export interface JobProvider {
  name: string
  search(params: JobSearchParams): Promise<JobSearchResult>
  getById(id: string): Promise<JobListing | null>
  isAvailable(): boolean
}
