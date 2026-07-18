import type { ParsedResumeOutput, PortfolioContentOutput } from '@/lib/ai/schemas'

// ProofScore is a structured career-readiness diagnostic, not a scientifically
// validated assessment. Every category score below is computed from concrete,
// countable facts in the user's own resume/portfolio data - never from an AI's
// subjective judgment - so the same input always produces the same score, and
// every score traces back to evidence the user can verify. AI is layered on
// top afterward only to explain *why*, never to decide *what*.

export type ProofScoreCategoryKey =
  | 'role_positioning'
  | 'first_impression'
  | 'target_role_alignment'
  | 'evidence_strength'
  | 'quantified_impact'
  | 'project_depth'
  | 'case_study_quality'
  | 'credibility_signals'
  | 'contact_readiness'
  | 'keyword_support'
  | 'presentation_clarity'

export interface CategoryDefinition {
  key: ProofScoreCategoryKey
  name: string
  weight: number
}

// Weights sum to 100. proof_strength-equivalent categories (evidence_strength,
// quantified_impact) and target_role_alignment count roughly double the others,
// matching the existing product framing that those are the highest-leverage levers.
export const CATEGORY_DEFINITIONS: readonly CategoryDefinition[] = Object.freeze([
  { key: 'role_positioning', name: 'Role positioning', weight: 8 },
  { key: 'first_impression', name: 'First-impression clarity', weight: 8 },
  { key: 'target_role_alignment', name: 'Target-role alignment', weight: 14 },
  { key: 'evidence_strength', name: 'Evidence strength', weight: 14 },
  { key: 'quantified_impact', name: 'Quantified impact', weight: 12 },
  { key: 'project_depth', name: 'Project depth', weight: 10 },
  { key: 'case_study_quality', name: 'Case-study quality', weight: 8 },
  { key: 'credibility_signals', name: 'Credibility signals', weight: 7 },
  { key: 'contact_readiness', name: 'Contact readiness', weight: 5 },
  { key: 'keyword_support', name: 'Keyword support', weight: 8 },
  { key: 'presentation_clarity', name: 'Presentation clarity', weight: 6 },
])

export const PROOF_SCORE_DIMENSION_COUNT = 11

// Free and Pro receive the same complete diagnostic. The product boundary is
// frequency (one successful audit per 24 hours on Free, ten on Pro), never a
// different score, a hidden dimension, or a weaker recommendation.
export const FALLBACK_FIXES: Readonly<Record<ProofScoreCategoryKey, string>> = Object.freeze({
  role_positioning: 'Rewrite your headline so it names the target role and one documented specialty from your resume.',
  first_impression: 'Add a two-to-three sentence summary that states your target role, strongest documented skill, and one supported result.',
  target_role_alignment: 'Add the target-role terms that truthfully match your experience to the relevant resume bullets or skills section.',
  evidence_strength: 'Replace one vague bullet with what you did, how you did it, and the supported outcome without adding facts you cannot verify.',
  quantified_impact: 'Review one achievement and add a truthful number you already know, such as scope, time, volume, users, or change; keep it qualitative if no number exists.',
  project_depth: 'Expand one real project with the problem, your specific contribution, the steps you took, and the outcome you can support.',
  case_study_quality: 'In your private portfolio, complete the Problem, Process, Outcome, and proof or link fields for one real project.',
  credibility_signals: 'Add one missing, verifiable signal you already own, such as education, a certification, GitHub, LinkedIn, or a project link.',
  contact_readiness: 'Add a current contact email and at least one professional link you control.',
  keyword_support: 'Compare the target-role wording with your resume and add only the matching skills or tools you actually used.',
  presentation_clarity: 'Add missing dates and keep each role to one-to-eight concise bullets ordered by relevance.',
})

const categoryKeys = CATEGORY_DEFINITIONS.map((definition) => definition.key)
if (
  CATEGORY_DEFINITIONS.length !== PROOF_SCORE_DIMENSION_COUNT
  || new Set(categoryKeys).size !== PROOF_SCORE_DIMENSION_COUNT
  || CATEGORY_DEFINITIONS.reduce((sum, definition) => sum + definition.weight, 0) !== 100
) {
  throw new Error('Evidence Audit must define exactly 11 unique dimensions with weights totaling 100')
}

export interface CategoryScore {
  key: ProofScoreCategoryKey
  name: string
  score: number | null
  maxScore: 100
  weight: number
  evidence: string[]
  severity: 'critical' | 'major' | 'minor'
  gated: false
}

export interface ProofScoreResult {
  overall_score: number
  categories: CategoryScore[]
}

export interface AuditCategoryExplanation {
  key: string
  explanation: string
  issues: string[]
  fix: string
  example: string
}

export interface AuditExplanation {
  summary: string
  categories: AuditCategoryExplanation[]
  missing_evidence: string[]
  top_priorities: string[]
}

export interface MergedAuditCategory extends CategoryScore {
  explanation: string
  issues: string[]
  fix: string
  example: string
  priority: number
}

export interface MergedAuditResult {
  overall_score: number
  summary: string
  categories: MergedAuditCategory[]
  missing_evidence: string[]
  top_priorities: string[]
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'by', 'is', 'are',
  'was', 'were', 'be', 'been', 'as', 'it', 'this', 'that', 'i', 'we', 'you', 'our', 'their',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.round(Math.max(lo, Math.min(hi, n)))
}

function severityFor(score: number | null): 'critical' | 'major' | 'minor' {
  if (score === null) return 'minor'
  if (score < 40) return 'critical'
  if (score < 70) return 'major'
  return 'minor'
}

const HAS_NUMBER = /\d/
const HAS_PERCENT_OR_MULTIPLIER = /\d+(\.\d+)?\s*(%|x|k\b|m\b|hours?|days?|weeks?|months?|users?|customers?)/i

function bulletHasMetric(bullet: string): boolean {
  return HAS_NUMBER.test(bullet) || HAS_PERCENT_OR_MULTIPLIER.test(bullet)
}

interface ScoreInput {
  key: ProofScoreCategoryKey
  score: number | null
  evidence: string[]
}

function scoreRolePositioning(parsed: ParsedResumeOutput | null, portfolio: PortfolioContentOutput | null, targetRole: string): ScoreInput {
  const evidence: string[] = []
  const targetWords = new Set(tokenize(targetRole))
  const headline = portfolio?.hero?.headline ?? parsed?.summary ?? ''
  const recentRole = parsed?.experience?.[0]?.role ?? ''
  const haystack = `${headline} ${recentRole}`.toLowerCase()
  const headlineWords = new Set(tokenize(haystack))
  const overlap = [...targetWords].filter((w) => headlineWords.has(w))

  if (!headline && !recentRole) {
    evidence.push('No headline, summary, or current role title found to position you for this role.')
    return { key: 'role_positioning', score: 0, evidence }
  }

  const score = targetWords.size === 0 ? 60 : clamp((overlap.length / targetWords.size) * 100)
  if (overlap.length > 0) {
    evidence.push(`Headline/role title shares "${overlap.join(', ')}" with your target role "${targetRole}".`)
  } else {
    evidence.push(`Your headline/role title does not mention any words from your target role "${targetRole}".`)
  }
  return { key: 'role_positioning', score, evidence }
}

function scoreFirstImpression(parsed: ParsedResumeOutput | null, portfolio: PortfolioContentOutput | null): ScoreInput {
  const evidence: string[] = []
  const summary = portfolio?.hero?.subheadline ?? parsed?.summary ?? ''
  const len = summary.trim().length

  if (len === 0) {
    evidence.push('No summary or subheadline found - the first thing a reviewer sees is currently blank.')
    return { key: 'first_impression', score: 0, evidence }
  }
  let score = 100
  if (len < 40) {
    score = 35
    evidence.push(`Summary is only ${len} characters - too short to communicate who you are.`)
  } else if (len > 500) {
    score = 55
    evidence.push(`Summary is ${len} characters - likely too long for a first impression.`)
  } else {
    evidence.push(`Summary is ${len} characters, a reasonable length for a first impression.`)
  }
  return { key: 'first_impression', score, evidence }
}

function scoreTargetRoleAlignment(parsed: ParsedResumeOutput | null, targetRole: string, industry: string): ScoreInput {
  const evidence: string[] = []
  if (!parsed) {
    evidence.push('No resume on file to check against the target role.')
    return { key: 'target_role_alignment', score: null, evidence }
  }
  const targetWords = new Set([...tokenize(targetRole), ...tokenize(industry)])
  if (targetWords.size === 0) {
    evidence.push('No target role specified.')
    return { key: 'target_role_alignment', score: null, evidence }
  }
  const resumeText = [
    parsed.summary ?? '',
    ...parsed.skills,
    ...parsed.experience.flatMap((e) => [e.role, ...e.bullets]),
  ].join(' ')
  const resumeWords = new Set(tokenize(resumeText))
  const overlap = [...targetWords].filter((w) => resumeWords.has(w))
  const score = clamp((overlap.length / targetWords.size) * 100)
  evidence.push(
    overlap.length > 0
      ? `${overlap.length}/${targetWords.size} target-role/industry terms appear in your resume (${overlap.slice(0, 6).join(', ')}).`
      : `None of the target-role/industry terms ("${targetRole}", "${industry}") appear in your resume content.`
  )
  return { key: 'target_role_alignment', score, evidence }
}

function scoreEvidenceStrength(parsed: ParsedResumeOutput | null): ScoreInput {
  const evidence: string[] = []
  if (!parsed) {
    evidence.push('No resume on file.')
    return { key: 'evidence_strength', score: null, evidence }
  }
  const totalBullets = parsed.experience.reduce((sum, e) => sum + e.bullets.length, 0)
  const weakCount = parsed.weak_bullets.length
  if (totalBullets === 0) {
    evidence.push('No experience bullets found to evaluate.')
    return { key: 'evidence_strength', score: 0, evidence }
  }
  const strongRatio = clamp(1 - weakCount / totalBullets, 0, 1)
  const score = clamp(strongRatio * 100)
  evidence.push(`${totalBullets - Math.min(weakCount, totalBullets)}/${totalBullets} bullets read as specific evidence rather than vague claims.`)
  if (weakCount > 0) evidence.push(`${weakCount} bullet(s) flagged as vague: "${parsed.weak_bullets[0]}"`)
  return { key: 'evidence_strength', score, evidence }
}

function scoreQuantifiedImpact(parsed: ParsedResumeOutput | null): ScoreInput {
  const evidence: string[] = []
  if (!parsed) {
    evidence.push('No resume on file.')
    return { key: 'quantified_impact', score: null, evidence }
  }
  const allBullets = parsed.experience.flatMap((e) => e.bullets)
  if (allBullets.length === 0) {
    evidence.push('No experience bullets found.')
    return { key: 'quantified_impact', score: 0, evidence }
  }
  const withMetric = allBullets.filter(bulletHasMetric).length
  const score = clamp((withMetric / allBullets.length) * 100)
  evidence.push(`${withMetric}/${allBullets.length} bullets include a number, percentage, or measurable outcome.`)
  return { key: 'quantified_impact', score, evidence }
}

function scoreProjectDepth(parsed: ParsedResumeOutput | null, portfolio: PortfolioContentOutput | null): ScoreInput {
  const evidence: string[] = []
  const portfolioProjects = portfolio?.projects ?? []
  const resumeProjects = parsed?.projects ?? []
  const total = portfolioProjects.length + resumeProjects.length
  if (total === 0) {
    evidence.push('No projects found on resume or portfolio.')
    return { key: 'project_depth', score: 0, evidence }
  }
  const substantive =
    portfolioProjects.filter((p) => p.problem && p.process && p.outcome).length +
    resumeProjects.filter((p) => p.description.length > 80 || p.has_outcome).length
  const score = clamp((substantive / total) * 100)
  evidence.push(`${substantive}/${total} projects have a substantive description or a clear outcome.`)
  return { key: 'project_depth', score, evidence }
}

function scoreCaseStudyQuality(portfolio: PortfolioContentOutput | null): ScoreInput {
  const evidence: string[] = []
  const projects = portfolio?.projects ?? []
  if (projects.length === 0) {
    evidence.push('No portfolio case studies found. A private draft is enough; publishing is not required for this dimension.')
    return { key: 'case_study_quality', score: null, evidence }
  }
  let totalPoints = 0
  const maxPoints = projects.length * 4
  for (const p of projects) {
    if (p.problem) totalPoints += 1
    if (p.process) totalPoints += 1
    if (p.outcome) totalPoints += 1
    if (p.metrics.length > 0 || p.links.length > 0) totalPoints += 1
  }
  const score = clamp((totalPoints / maxPoints) * 100)
  evidence.push(`Case studies average ${(totalPoints / projects.length).toFixed(1)}/4 on problem/process/outcome/proof completeness.`)
  return { key: 'case_study_quality', score, evidence }
}

function scoreCredibilitySignals(parsed: ParsedResumeOutput | null, portfolio: PortfolioContentOutput | null): ScoreInput {
  const evidence: string[] = []
  const certs = parsed?.certifications.length ?? 0
  const education = parsed?.education.length ?? 0
  const links = {
    linkedin: parsed?.links?.linkedin?.trim() || portfolio?.contact?.linkedin?.trim() || null,
    github: parsed?.links?.github?.trim() || portfolio?.contact?.github?.trim() || null,
    website: parsed?.links?.website?.trim() || portfolio?.contact?.website?.trim() || null,
    portfolio: parsed?.links?.portfolio?.trim() || null,
  }
  const linkCount = Object.values(links).filter(Boolean).length
  const points = (certs > 0 ? 1 : 0) + (education > 0 ? 1 : 0) + (linkCount > 0 ? 2 : 0)
  const score = clamp((points / 4) * 100)
  evidence.push(`Education: ${education > 0 ? 'present' : 'missing'}. Certifications: ${certs}. Professional links: ${linkCount}.`)
  return { key: 'credibility_signals', score, evidence }
}

function scoreContactReadiness(parsed: ParsedResumeOutput | null, portfolio: PortfolioContentOutput | null): ScoreInput {
  const evidence: string[] = []
  const email = parsed?.email?.trim() || portfolio?.contact?.email?.trim() || null
  const links = {
    linkedin: parsed?.links?.linkedin?.trim() || portfolio?.contact?.linkedin?.trim() || null,
    github: parsed?.links?.github?.trim() || portfolio?.contact?.github?.trim() || null,
    website: parsed?.links?.website?.trim() || portfolio?.contact?.website?.trim() || null,
    portfolio: parsed?.links?.portfolio?.trim() || null,
  }
  const hasLink = Object.values(links).some(Boolean)
  const points = (email ? 2 : 0) + (hasLink ? 2 : 0)
  const score = clamp((points / 4) * 100)
  if (!email) evidence.push('No email address found - a recruiter cannot reach you.')
  if (!hasLink) evidence.push('No LinkedIn, GitHub, website, or portfolio link found.')
  if (email && hasLink) evidence.push('Email and at least one professional link are present.')
  return { key: 'contact_readiness', score, evidence }
}

function scoreKeywordSupport(parsed: ParsedResumeOutput | null, targetRole: string): ScoreInput {
  const evidence: string[] = []
  if (!parsed) {
    evidence.push('No resume on file.')
    return { key: 'keyword_support', score: null, evidence }
  }
  const skillCount = parsed.skills.length
  const targetWords = tokenize(targetRole).length
  const score = clamp(Math.min(skillCount * 8, 100) * (targetWords > 0 ? 1 : 0.8))
  evidence.push(`${skillCount} distinct skills listed${skillCount < 5 ? ' - ATS keyword matching needs more breadth' : '.'}`)
  return { key: 'keyword_support', score, evidence }
}

function scorePresentationClarity(parsed: ParsedResumeOutput | null): ScoreInput {
  const evidence: string[] = []
  if (!parsed) {
    evidence.push('No resume on file.')
    return { key: 'presentation_clarity', score: null, evidence }
  }
  const experiences = parsed.experience
  if (experiences.length === 0) {
    evidence.push('No experience entries found.')
    return { key: 'presentation_clarity', score: 0, evidence }
  }
  const withDates = experiences.filter((e) => e.period && e.period.trim().length > 0).length
  const reasonableBulletCount = experiences.filter((e) => e.bullets.length >= 1 && e.bullets.length <= 8).length
  const datesScore = (withDates / experiences.length) * 50
  const bulletsScore = (reasonableBulletCount / experiences.length) * 50
  const score = clamp(datesScore + bulletsScore)
  evidence.push(`${withDates}/${experiences.length} roles have dates. ${reasonableBulletCount}/${experiences.length} roles have a reasonable bullet count (1-8).`)
  return { key: 'presentation_clarity', score, evidence }
}

export function computeProofScore(
  parsed: ParsedResumeOutput | null,
  portfolio: PortfolioContentOutput | null,
  targetRole: string,
  industry: string,
): ProofScoreResult {
  const raw: ScoreInput[] = [
    scoreRolePositioning(parsed, portfolio, targetRole),
    scoreFirstImpression(parsed, portfolio),
    scoreTargetRoleAlignment(parsed, targetRole, industry),
    scoreEvidenceStrength(parsed),
    scoreQuantifiedImpact(parsed),
    scoreProjectDepth(parsed, portfolio),
    scoreCaseStudyQuality(portfolio),
    scoreCredibilitySignals(parsed, portfolio),
    scoreContactReadiness(parsed, portfolio),
    scoreKeywordSupport(parsed, targetRole),
    scorePresentationClarity(parsed),
  ]

  const byKey = new Map(raw.map((r) => [r.key, r]))
  const categories: CategoryScore[] = CATEGORY_DEFINITIONS.map((def) => {
    const computed = byKey.get(def.key)
    if (!computed) throw new Error(`Missing deterministic Evidence Audit dimension: ${def.key}`)
    return {
      key: def.key,
      name: def.name,
      score: computed.score,
      maxScore: 100 as const,
      weight: def.weight,
      evidence: computed.evidence,
      severity: severityFor(computed.score),
      gated: false,
    }
  })

  const scored = categories.filter((c) => c.score !== null)
  const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0)
  const overall_score =
    totalWeight === 0 ? 0 : Math.round(scored.reduce((sum, c) => sum + c.score! * c.weight, 0) / totalWeight)

  return { overall_score, categories }
}

/**
 * Attach grounded AI explanations to the authoritative deterministic result.
 * The fixed deterministic list drives the output, so duplicate, missing, or
 * unknown AI category keys can never add, remove, or gate a dimension.
 */
export function mergeAuditExplanation(
  deterministic: ProofScoreResult,
  explanation: AuditExplanation,
): MergedAuditResult {
  const explanationByKey = new Map<string, AuditCategoryExplanation>()
  for (const category of explanation.categories) {
    if (!explanationByKey.has(category.key)) explanationByKey.set(category.key, category)
  }

  const rankedKeys = deterministic.categories
    .filter((category) => category.score !== null)
    .slice()
    .sort((a, b) => (
      b.weight * (100 - (b.score ?? 100)) - a.weight * (100 - (a.score ?? 100))
    ))
    .map((category) => category.key)

  const categories: MergedAuditCategory[] = deterministic.categories.map((category) => {
    const ai = explanationByKey.get(category.key)
    const aiFix = ai?.fix.trim() ?? ''
    const aiExplanation = ai?.explanation.trim() ?? ''
    return {
      ...category,
      explanation: aiExplanation || category.evidence.join(' ') || 'No evidence was available for this dimension.',
      issues: ai?.issues ?? [],
      fix: aiFix || FALLBACK_FIXES[category.key],
      example: ai?.example ?? '',
      priority: category.score === null ? 0 : rankedKeys.indexOf(category.key) + 1,
      gated: false,
    }
  })

  const suppliedPriorities = explanation.top_priorities
    .map((priority) => priority.trim())
    .filter(Boolean)
  const fallbackPriorities = categories
    .filter((category) => category.priority > 0)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map((category) => category.fix)

  return {
    overall_score: deterministic.overall_score,
    summary: explanation.summary.trim() || 'Review the 11 dimensions below for the strongest evidence and the next concrete fixes.',
    categories,
    missing_evidence: explanation.missing_evidence,
    top_priorities: suppliedPriorities.length > 0 ? suppliedPriorities : fallbackPriorities,
  }
}
