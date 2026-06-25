// Pure computation connecting Story Bank entries to the canonical competency set —
// "how prepared am I to answer using my actual stories" per competency, not a
// decorative chart. Every connection here maps to a real interview_story_bank row;
// nothing is inferred or invented.
import { CANONICAL_COMPETENCIES, type CanonicalCompetency } from './competencies.ts'

export interface EvidenceStoryInput {
  id: string
  title: string
  competencies: string[]
  outcome: string | null
  verifiedMetrics: unknown[]
  resumeSourceId: string | null
  projectSourceId: string | null
  lastPracticedAt: string | null
}

export interface CompetencyCoverage {
  competency: CanonicalCompetency
  covered: boolean
  storyCount: number
  strongestStoryId: string | null
  hasOutcome: boolean
  hasVerifiedMetrics: boolean
  hasLinkedSource: boolean
  lastPracticedAt: string | null
}

export interface EvidenceCoverageSummary {
  covered: CompetencyCoverage[]
  missingCompetencies: CanonicalCompetency[]
  storiesNeedingOutcome: number
  storiesNeedingSource: number
  strongestStory: { id: string; title: string } | null
  verifiedMetricCount: number
}

function storyStrength(s: EvidenceStoryInput): number {
  let score = 0
  if (s.outcome) score += 1
  if (s.verifiedMetrics.length > 0) score += 1
  if (s.resumeSourceId || s.projectSourceId) score += 1
  if (s.lastPracticedAt) score += 1
  return score
}

export function computeEvidenceCoverage(stories: EvidenceStoryInput[]): EvidenceCoverageSummary {
  const covered: CompetencyCoverage[] = CANONICAL_COMPETENCIES.map((competency) => {
    const matching = stories.filter((s) => s.competencies.includes(competency))
    const sorted = [...matching].sort((a, b) => storyStrength(b) - storyStrength(a))
    const best = sorted[0] ?? null
    return {
      competency,
      covered: matching.length > 0,
      storyCount: matching.length,
      strongestStoryId: best?.id ?? null,
      hasOutcome: matching.some((s) => !!s.outcome),
      hasVerifiedMetrics: matching.some((s) => s.verifiedMetrics.length > 0),
      hasLinkedSource: matching.some((s) => !!s.resumeSourceId || !!s.projectSourceId),
      lastPracticedAt: matching.reduce<string | null>((latest, s) => {
        if (!s.lastPracticedAt) return latest
        if (!latest) return s.lastPracticedAt
        return new Date(s.lastPracticedAt) > new Date(latest) ? s.lastPracticedAt : latest
      }, null),
    }
  })

  const missingCompetencies = covered.filter((c) => !c.covered).map((c) => c.competency)
  const storiesNeedingOutcome = stories.filter((s) => !s.outcome).length
  const storiesNeedingSource = stories.filter((s) => !s.resumeSourceId && !s.projectSourceId).length
  const verifiedMetricCount = stories.reduce((sum, s) => sum + s.verifiedMetrics.length, 0)

  const ranked = [...stories].sort((a, b) => storyStrength(b) - storyStrength(a))
  const strongestStory = ranked[0] ? { id: ranked[0].id, title: ranked[0].title } : null

  return { covered, missingCompetencies, storiesNeedingOutcome, storiesNeedingSource, strongestStory, verifiedMetricCount }
}
