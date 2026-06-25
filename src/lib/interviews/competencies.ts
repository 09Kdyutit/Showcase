// The canonical, story-tellable competency set — distinct from the 12 scoring
// DIMENSION_IDS (rubrics.ts) and from the ~40 narrow per-question competency tags
// (question-bank). Those two are for scoring and question selection; this one is for
// "what kind of story can a user actually tell," and is what Story Bank entries are
// tagged against. A story may use other freeform tags too; this list only drives
// coverage displays (Story Bank's strip, the Hub's Evidence Coverage), never a hard
// restriction on what a user can type.
export const CANONICAL_COMPETENCIES = [
  'leadership', 'conflict', 'failure', 'ownership', 'ambiguity',
  'collaboration', 'prioritization', 'learning', 'technical_judgment', 'customer_focus',
] as const
export type CanonicalCompetency = (typeof CANONICAL_COMPETENCIES)[number]

export const CANONICAL_COMPETENCY_LABELS: Record<CanonicalCompetency, string> = {
  leadership: 'Leadership', conflict: 'Conflict', failure: 'Failure & Recovery', ownership: 'Ownership',
  ambiguity: 'Ambiguity', collaboration: 'Collaboration', prioritization: 'Prioritization',
  learning: 'Learning', technical_judgment: 'Technical Judgment', customer_focus: 'Customer Focus',
}
