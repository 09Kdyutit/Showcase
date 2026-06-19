// Hard role-family filter for the "For You" feed. Skill-keyword overlap alone (computeMatchScore)
// is a soft signal — two unrelated roles can share generic keywords ("communication",
// "leadership") and still score reasonably. This module answers a different, prior question:
// is this job even in the right *family* of work at all? A Wastewater Process Engineer and a
// Software Engineer both have "Engineer" in the title but are not the same job family, and a
// candidate targeting one should never see the other in a strict, non-adjacent feed.
//
// Ordering matters: more specific families are checked before generic ones so "process
// engineer" / "mechanical engineer" don't get swallowed by the generic "engineering" bucket.

export type RoleFamily =
  | 'engineering'
  | 'industrial_engineering'
  | 'data'
  | 'product'
  | 'design'
  | 'marketing'
  | 'sales'
  | 'customer_success'
  | 'operations'
  | 'finance'
  | 'hr'
  | 'legal'
  | 'executive'

const FAMILY_KEYWORDS: Array<{ family: RoleFamily; keywords: string[] }> = [
  {
    family: 'industrial_engineering',
    keywords: [
      'process engineer', 'wastewater', 'mechanical engineer', 'civil engineer', 'chemical engineer',
      'electrical engineer', 'manufacturing engineer', 'industrial engineer', 'structural engineer',
      'environmental engineer', 'water treatment', 'plant engineer', 'field engineer',
    ],
  },
  {
    family: 'data',
    keywords: [
      'data engineer', 'data scientist', 'data analyst', 'analytics engineer', 'machine learning engineer',
      'ml engineer', 'ai engineer', 'business intelligence', 'data engineering',
    ],
  },
  {
    family: 'engineering',
    keywords: [
      'software engineer', 'software developer', 'swe', 'full stack', 'fullstack', 'frontend', 'front-end',
      'backend', 'back-end', 'devops', 'site reliability', 'sre', 'platform engineer', 'infrastructure engineer',
      'mobile engineer', 'ios engineer', 'android engineer', 'qa engineer', 'test engineer', 'systems engineer',
      'security engineer', 'cloud engineer', 'embedded engineer', 'firmware engineer', 'web developer',
      'engineering manager', 'staff engineer', 'principal engineer', 'tech lead',
    ],
  },
  {
    family: 'product',
    keywords: ['product manager', 'product owner', 'product lead', 'group product manager', 'technical product manager', 'head of product'],
  },
  {
    family: 'design',
    keywords: ['product designer', 'ux designer', 'ui designer', 'visual designer', 'graphic designer', 'design lead', 'design manager', 'ux researcher', 'interaction designer'],
  },
  {
    family: 'marketing',
    keywords: ['marketing manager', 'growth marketing', 'content marketing', 'demand generation', 'seo specialist', 'brand manager', 'marketing director', 'product marketing'],
  },
  {
    family: 'sales',
    keywords: ['account executive', 'sales rep', 'sales manager', 'business development', 'bdr', 'sdr', 'sales director', 'account manager'],
  },
  {
    family: 'customer_success',
    keywords: ['customer success', 'support engineer', 'technical support', 'customer support', 'support specialist'],
  },
  {
    family: 'operations',
    keywords: ['operations manager', 'business operations', 'supply chain', 'logistics', 'program manager', 'project manager', 'ops manager'],
  },
  {
    family: 'finance',
    keywords: ['financial analyst', 'accountant', 'controller', 'fp&a', 'finance manager', 'finance director', 'bookkeeper'],
  },
  {
    family: 'hr',
    keywords: ['recruiter', 'hr business partner', 'talent acquisition', 'people ops', 'human resources', 'people partner'],
  },
  {
    family: 'legal',
    keywords: ['counsel', 'paralegal', 'compliance officer', 'legal'],
  },
  {
    family: 'executive',
    keywords: ['chief executive', 'chief technology officer', 'chief product officer', 'chief operating officer', 'vp of', 'vice president', 'head of engineering'],
  },
]

// Sparse and conservative on purpose — most families have no adjacents. A Software Engineer
// and a Product Manager are not automatically interchangeable even though they collaborate daily.
const ADJACENT_FAMILIES: Partial<Record<RoleFamily, RoleFamily[]>> = {
  engineering: ['data'],
  data: ['engineering'],
  product: ['design'],
  design: ['product'],
  marketing: ['sales'],
  sales: ['marketing', 'customer_success'],
  customer_success: ['sales'],
  finance: ['operations'],
  operations: ['finance'],
}

export function classifyRoleFamily(title: string | null | undefined): RoleFamily | null {
  if (!title) return null
  const t = title.toLowerCase()
  for (const { family, keywords } of FAMILY_KEYWORDS) {
    if (keywords.some((k) => t.includes(k))) return family
  }
  return null
}

export function isSameOrAdjacentFamily(a: RoleFamily | null, b: RoleFamily | null, allowAdjacent: boolean): boolean {
  if (!a || !b) return true // can't classify — don't hard-exclude on uncertain data
  if (a === b) return true
  if (!allowAdjacent) return false
  return (ADJACENT_FAMILIES[a] ?? []).includes(b)
}

export function isAdjacentFamily(a: RoleFamily | null, b: RoleFamily | null): boolean {
  if (!a || !b || a === b) return false
  return (ADJACENT_FAMILIES[a] ?? []).includes(b)
}
