import type { JobListing, StructuredJobData } from '@/types/database'
import type { JobProvider, JobSearchParams, JobSearchResult } from './types'

function makeJob(partial: Partial<JobListing> & Pick<JobListing, 'title' | 'company'>): JobListing {
  return {
    id: partial.id ?? crypto.randomUUID(),
    provider: 'fixture',
    provider_job_id: partial.provider_job_id ?? null,
    source_url: partial.source_url ?? null,
    location: partial.location ?? 'San Francisco, CA',
    work_mode: partial.work_mode ?? 'hybrid',
    employment_type: partial.employment_type ?? 'full-time',
    seniority: partial.seniority ?? 'mid',
    salary_min: partial.salary_min ?? null,
    salary_max: partial.salary_max ?? null,
    salary_currency: 'USD',
    description: partial.description ?? null,
    structured_data: partial.structured_data ?? null,
    posted_at: partial.posted_at ?? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
    ...partial,
  }
}

const SD_PM: StructuredJobData = {
  responsibilities: [
    'Define product vision and roadmap for our core SaaS platform',
    'Partner with engineering and design to ship high-quality features',
    'Conduct customer interviews and synthesize user research',
    'Write clear product specs with acceptance criteria',
    'Monitor KPIs and drive data-informed decisions',
    'Coordinate cross-functional launches with marketing and support',
  ],
  required_skills: ['Product management', 'Roadmapping', 'User research', 'Agile/Scrum', 'SQL basics', 'Stakeholder management'],
  preferred_skills: ['B2B SaaS experience', 'Figma', 'Amplitude or Mixpanel', 'JTBD framework', 'API familiarity'],
  experience_requirements: ['3-5 years of product management experience', 'Shipped at least one 0→1 product', 'Experience at a growth-stage startup'],
  education_requirements: [],
  keywords: ['product manager', 'SaaS', 'roadmap', 'user research', 'agile', 'B2B'],
  company_info: 'Series B startup building workflow automation for ops teams. 120 employees, remote-first.',
  benefits: ['Equity', 'Health/dental/vision', 'Remote-first', '$3k learning budget'],
  domain: 'B2B SaaS / Workflow Automation',
  risk_flags: [],
}

const SD_DESIGN: StructuredJobData = {
  responsibilities: [
    'Lead end-to-end design for our checkout and payments product surface',
    'Create wireframes, prototypes, and high-fidelity designs in Figma',
    'Conduct usability tests and synthesize findings into design decisions',
    'Collaborate with engineers daily on implementation details',
    'Contribute to and evolve our design system',
    'Present designs to stakeholders and incorporate feedback',
  ],
  required_skills: ['Figma', 'UX research', 'Visual design', 'Prototyping', 'Design systems', 'Accessibility'],
  preferred_skills: ['Motion design', 'Front-end HTML/CSS basics', 'Stripe design language', 'B2B product design'],
  experience_requirements: ['4+ years of product/UX design', 'Strong portfolio with complex product work', 'Experience on payments or fintech products preferred'],
  education_requirements: [],
  keywords: ['product designer', 'UX', 'Figma', 'checkout', 'fintech', 'design system'],
  company_info: 'Fintech infrastructure company. Series C. Offices in NYC and remote.',
  benefits: ['RSUs', 'Full benefits', 'Home office stipend', 'Annual retreat'],
  domain: 'Fintech / Payments',
  risk_flags: [],
}

const SD_FRONTEND: StructuredJobData = {
  responsibilities: [
    'Build responsive, accessible UI components using React and TypeScript',
    'Implement performance-critical features on our customer dashboard',
    'Write unit and integration tests with high coverage',
    'Collaborate with design to translate Figma specs into production code',
    'Participate in code reviews and maintain coding standards',
    'Optimize Core Web Vitals and page performance',
  ],
  required_skills: ['React', 'TypeScript', 'CSS', 'Testing (Jest/Vitest)', 'Git', 'REST APIs'],
  preferred_skills: ['Next.js', 'Tailwind CSS', 'GraphQL', 'Storybook', 'Web accessibility (WCAG)'],
  experience_requirements: ['2-4 years of front-end engineering', 'Strong TypeScript skills', 'Experience with modern React patterns'],
  education_requirements: [],
  keywords: ['frontend', 'React', 'TypeScript', 'Next.js', 'UI engineer'],
  company_info: 'Developer tools company. Seed to Series A. Fully distributed team.',
  benefits: ['Equity', 'Async-first culture', 'Annual company retreat', 'Full equipment budget'],
  domain: 'Developer Tools',
  risk_flags: [],
}

const SD_DATA: StructuredJobData = {
  responsibilities: [
    'Design and maintain data pipelines that power business analytics',
    'Build and own our self-serve analytics layer in dbt',
    'Partner with product and growth to define and instrument key metrics',
    'Create dashboards in Looker for C-suite and department heads',
    'Run ad-hoc analysis to answer critical business questions',
    'Champion data quality and documentation across the stack',
  ],
  required_skills: ['SQL', 'Python', 'dbt', 'Data warehousing (Snowflake/BigQuery)', 'BI tools', 'ETL/ELT'],
  preferred_skills: ['Looker', 'Airflow', 'Spark', 'A/B testing', 'Causal inference'],
  experience_requirements: ['3+ years in data engineering or analytics engineering', 'Strong SQL and Python', 'Experience modeling large datasets'],
  education_requirements: ['Degree in CS, Statistics, or related field preferred'],
  keywords: ['data engineer', 'analytics engineering', 'dbt', 'SQL', 'Snowflake', 'Looker'],
  company_info: 'E-commerce platform serving 50M+ users. Public company.',
  benefits: ['RSUs', 'Full benefits', 'On-site gym', 'Flexible PTO'],
  domain: 'E-commerce / Analytics',
  risk_flags: [],
}

const SD_STAFF_ENG: StructuredJobData = {
  responsibilities: [
    'Set technical direction for our platform engineering team (12 engineers)',
    'Lead architectural decisions for our multi-tenant SaaS infrastructure',
    'Define and enforce engineering standards, code quality, and delivery practices',
    'Partner with product leadership on technical feasibility and roadmap',
    'Mentor senior engineers and drive technical growth on the team',
    'Own reliability and scaling of services handling 10M+ daily events',
  ],
  required_skills: ['Distributed systems', 'System design', 'Technical leadership', 'Cloud (AWS/GCP)', 'Performance engineering', 'API design'],
  preferred_skills: ['Kubernetes', 'Kafka', 'Multi-tenancy patterns', 'Go or Rust', 'FinOps / cost optimization'],
  experience_requirements: ['8+ years of software engineering', '2+ years at staff or principal level', 'Experience scaling systems to significant traffic'],
  education_requirements: [],
  keywords: ['staff engineer', 'platform engineering', 'distributed systems', 'technical leadership', 'infrastructure'],
  company_info: 'Enterprise SaaS company, post-IPO. Engineering team of 200+.',
  benefits: ['Top-of-market cash', 'RSUs', 'Full benefits', 'Remote-first', '401k match'],
  domain: 'Enterprise SaaS / Platform Engineering',
  risk_flags: [],
}

const SD_MARKETING: StructuredJobData = {
  responsibilities: [
    'Own demand generation campaigns across paid, email, and content channels',
    'Build and optimize lead nurture programs in HubSpot',
    'Partner with sales to align messaging and improve MQL→SQL conversion',
    'Manage paid media budget of $200k/quarter across Google and LinkedIn',
    'Report on pipeline attribution and campaign ROI to leadership',
    'Run A/B tests on landing pages and email sequences',
  ],
  required_skills: ['Demand generation', 'HubSpot', 'Paid media (Google Ads, LinkedIn)', 'Email marketing', 'Analytics (GA4)', 'Copywriting'],
  preferred_skills: ['Salesforce', 'ABM strategy', 'SEO', 'Webinar/event marketing', 'SQL basics'],
  experience_requirements: ['3-5 years in B2B marketing', 'Experience owning demand gen budget', 'Strong written communication'],
  education_requirements: [],
  keywords: ['demand generation', 'B2B marketing', 'HubSpot', 'paid media', 'pipeline'],
  company_info: 'HR tech startup. Series A. Offices in Austin and remote.',
  benefits: ['Equity', 'Health insurance', 'Remote-friendly', '$2k conference budget'],
  domain: 'HR Tech / B2B Marketing',
  risk_flags: [],
}

export const FIXTURE_JOBS: JobListing[] = [
  makeJob({
    id: 'fixture-1',
    provider_job_id: 'fixture-pm-1',
    title: 'Senior Product Manager, Platform',
    company: 'Meridian',
    location: 'New York, NY',
    work_mode: 'hybrid',
    seniority: 'senior',
    salary_min: 155000,
    salary_max: 195000,
    posted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    description: `We're looking for a Senior PM to own the core platform roadmap at Meridian - a Series B workflow automation startup with 120 people and serious momentum.\n\nYou'll work closely with our Head of Product to define what we build, partner with a 14-person engineering team to ship it, and own the metrics that determine if it worked. This isn't a process-heavy PM role - it's a ship-and-learn environment.\n\nIf you've shipped B2B SaaS products from 0→1, have opinions grounded in customer research, and enjoy working close to the code, you'll fit here.`,
    structured_data: SD_PM,
  }),
  makeJob({
    id: 'fixture-2',
    provider_job_id: 'fixture-design-1',
    title: 'Product Designer - Checkout & Payments',
    company: 'Volta Financial',
    location: 'New York, NY',
    work_mode: 'remote',
    seniority: 'mid',
    salary_min: 130000,
    salary_max: 165000,
    employment_type: 'full-time',
    posted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    description: `Volta is building the infrastructure layer for embedded payments. Our customers are mid-market e-commerce brands and we process $4B in annualized volume.\n\nWe need a product designer who lives in the checkout funnel - someone who can take a complex payment flow, find where it breaks, and ship a better experience. You'll own design for our checkout SDK, disputes UI, and merchant dashboard.\n\nThis role is fully remote. You'll work directly with 2 PMs and 8 engineers.`,
    structured_data: SD_DESIGN,
  }),
  makeJob({
    id: 'fixture-3',
    provider_job_id: 'fixture-fe-1',
    title: 'Frontend Engineer (React/TypeScript)',
    company: 'Arclight',
    location: 'Remote',
    work_mode: 'remote',
    seniority: 'mid',
    salary_min: 140000,
    salary_max: 175000,
    posted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    description: `Arclight builds code coverage and observability tooling for engineering teams. We're a team of 28, seed-funded, growing fast.\n\nWe need a frontend engineer who cares deeply about the quality of what they ship - accessible, performant, tested. You'll build the UI for our dashboard, collaborate daily with our two designers, and contribute to our component library.`,
    structured_data: SD_FRONTEND,
  }),
  makeJob({
    id: 'fixture-4',
    provider_job_id: 'fixture-data-1',
    title: 'Analytics Engineer',
    company: 'Grove Commerce',
    location: 'Austin, TX',
    work_mode: 'hybrid',
    seniority: 'mid',
    salary_min: 125000,
    salary_max: 155000,
    posted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    description: `Grove Commerce is a public e-commerce platform serving 50M+ buyers. We generate enormous amounts of data and we're still building the infrastructure to make it useful.\n\nYou'll join a data team of 9 and own our dbt semantic layer - the models that every analyst, PM, and exec depends on for their reports. Strong SQL, strong opinions, and a track record of improving data quality matter most.`,
    structured_data: SD_DATA,
  }),
  makeJob({
    id: 'fixture-5',
    provider_job_id: 'fixture-staff-1',
    title: 'Staff Software Engineer, Platform',
    company: 'Fieldstack',
    location: 'San Francisco, CA',
    work_mode: 'hybrid',
    seniority: 'staff',
    salary_min: 220000,
    salary_max: 280000,
    posted_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    description: `Fieldstack is a post-IPO enterprise SaaS company (field service management) with 850 employees and engineering teams in SF, London, and Bangalore.\n\nWe're looking for a Staff Engineer to join our Platform org and lead architectural decisions for our multi-tenant infrastructure - the layer every product team builds on top of. You'll set direction, raise quality, and mentor senior engineers. Real impact, real scope.`,
    structured_data: SD_STAFF_ENG,
  }),
  makeJob({
    id: 'fixture-6',
    provider_job_id: 'fixture-mktg-1',
    title: 'Senior Demand Generation Manager',
    company: 'Hatchwork',
    location: 'Austin, TX',
    work_mode: 'remote',
    seniority: 'senior',
    salary_min: 110000,
    salary_max: 140000,
    posted_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    description: `Hatchwork is an HR tech startup automating performance reviews and 1:1s. We closed our Series A 6 months ago and are building out our GTM team.\n\nYou'll own our demand generation function - from strategy to execution. You'll manage a $200k/quarter paid budget, build our HubSpot nurture programs, and report pipeline metrics to the CEO weekly. This is a high-ownership role at the right stage to have real impact.`,
    structured_data: SD_MARKETING,
  }),
  makeJob({
    id: 'fixture-7',
    provider_job_id: 'fixture-pm-2',
    title: 'Product Manager, Growth',
    company: 'Beacon Health',
    location: 'Remote',
    work_mode: 'remote',
    seniority: 'mid',
    salary_min: 130000,
    salary_max: 160000,
    employment_type: 'full-time',
    posted_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    description: `Beacon is a mental health benefits platform used by 400+ employers and 2M+ covered lives. We're growing fast and building the product team to match.\n\nThis PM role owns our activation and engagement funnel - helping members discover care, reducing time-to-first-appointment, and improving retention. You'll work with a growth-focused engineering team and have access to rich behavioral data.`,
    structured_data: {
      ...SD_PM,
      domain: 'Healthcare / Mental Health Tech',
      keywords: ['product manager', 'growth', 'activation', 'healthcare', 'B2B2C'],
    },
  }),
  makeJob({
    id: 'fixture-8',
    provider_job_id: 'fixture-fe-2',
    title: 'Senior Frontend Engineer - Design Systems',
    company: 'Parallax',
    location: 'San Francisco, CA',
    work_mode: 'hybrid',
    seniority: 'senior',
    salary_min: 175000,
    salary_max: 215000,
    posted_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    description: `Parallax makes financial planning software for agencies and consultancies. We're 180 people, Series C.\n\nWe're hiring a senior frontend engineer to join our Design Systems team - the 4-person team that owns the component library used by 30 product engineers. You'll write components, document them, and work directly with our two senior designers to improve consistency and velocity across the product.`,
    structured_data: {
      ...SD_FRONTEND,
      domain: 'Financial Software / Design Systems',
    },
  }),
]

// Simple text-match filter for fixture search
function matchesQuery(job: JobListing, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    job.title.toLowerCase().includes(q) ||
    job.company.toLowerCase().includes(q) ||
    (job.location ?? '').toLowerCase().includes(q) ||
    (job.structured_data?.required_skills ?? []).some(s => s.toLowerCase().includes(q)) ||
    (job.structured_data?.keywords ?? []).some(k => k.toLowerCase().includes(q))
  )
}

export class FixtureProvider implements JobProvider {
  name = 'fixture'

  isAvailable() { return true }

  async search(params: JobSearchParams): Promise<JobSearchResult> {
    let results = [...FIXTURE_JOBS]

    if (params.query) results = results.filter(j => matchesQuery(j, params.query!))
    if (params.work_mode) results = results.filter(j => j.work_mode === params.work_mode)
    if (params.seniority) results = results.filter(j => j.seniority === params.seniority)
    if (params.employment_type) results = results.filter(j => j.employment_type === params.employment_type)
    if (params.salary_min) results = results.filter(j => !j.salary_max || j.salary_max >= params.salary_min!)
    if (params.location) {
      const loc = params.location.toLowerCase()
      results = results.filter(j =>
        (j.location ?? '').toLowerCase().includes(loc) ||
        j.work_mode === 'remote'
      )
    }
    if (params.date_posted_days) {
      const cutoff = new Date(Date.now() - params.date_posted_days * 24 * 60 * 60 * 1000)
      results = results.filter(j => !j.posted_at || new Date(j.posted_at) >= cutoff)
    }

    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const start = (page - 1) * limit
    const paged = results.slice(start, start + limit)

    return {
      jobs: paged,
      total: results.length,
      page,
      has_more: start + limit < results.length,
      provider: 'fixture',
      is_demo: true,
    }
  }

  async getById(id: string): Promise<JobListing | null> {
    return FIXTURE_JOBS.find(j => j.id === id) ?? null
  }
}
