import { z } from 'zod'

// ── ParsedResume ──────────────────────────────────────────────────────────────
export const ParsedResumeSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  summary: z.string().nullable(),
  skills: z.array(z.string()),
  experience: z.array(z.object({
    company: z.string(),
    role: z.string(),
    period: z.string(),
    bullets: z.array(z.string()),
    metrics: z.array(z.string()),
    has_metrics: z.boolean().nullable().optional(),
  })),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    year: z.string().nullable().optional(),
  })),
  projects: z.array(z.object({
    title: z.string(),
    description: z.string(),
    technologies: z.array(z.string()),
    links: z.array(z.string()),
    has_outcome: z.boolean().nullable().optional(),
  })),
  certifications: z.array(z.string()),
  links: z.object({
    linkedin: z.string().nullable().optional(),
    github: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    portfolio: z.string().nullable().optional(),
  }),
  weak_bullets: z.array(z.string()),
  missing_proof: z.array(z.string()),
  possible_case_studies: z.array(z.string()),
  overall_resume_quality: z.enum(['strong', 'average', 'weak']).nullable().optional(),
  years_of_experience: z.number().nullable().optional(),
  seniority_level: z.enum(['student', 'junior', 'mid', 'senior', 'lead', 'executive']).nullable().optional(),
})

export type ParsedResumeOutput = z.infer<typeof ParsedResumeSchema>

// ── ImprovedResumeBullet ──────────────────────────────────────────────────────
export const ImprovedBulletSchema = z.object({
  improved: z.string(),
  explanation: z.string(),
  missing_info: z.array(z.string()),
  could_be_case_study: z.boolean().nullable().optional(),
})

export type ImprovedBulletOutput = z.infer<typeof ImprovedBulletSchema>

// ── RoleMatchResult ───────────────────────────────────────────────────────────
export const RoleMatchSchema = z.object({
  match_score: z.number(),
  verdict: z.enum(['ready_now', 'nearly_ready', 'developing', 'significant_gap', 'career_change']).nullable().optional(),
  matching_skills: z.array(z.string()),
  missing_skills: z.array(z.string()),
  transferable_skills: z.array(z.string()),
  experience_gaps: z.array(z.string()),
  strengths: z.array(z.string()),
  recommendations: z.array(z.string()),
  realistic_timeline: z.string(),
  strongest_asset: z.string().nullable().optional(),
})

export type RoleMatchOutput = z.infer<typeof RoleMatchSchema>

// ── AuditResult ───────────────────────────────────────────────────────────────
// score/maxScore/severity/priority are NOT part of what the AI returns - they come from
// the deterministic engine in src/lib/proofscore/engine.ts. The AI is given the precomputed
// score + evidence per category and asked only to explain it in plain language; it cannot
// change the number. This is enforced structurally (the AI's schema has no score field at
// all), not just by prompt instruction.
export const AuditCategoryExplanationSchema = z.object({
  key: z.string(),
  explanation: z.string(),
  issues: z.array(z.string()),
  fix: z.string(),
  example: z.string(),
})

export const AuditExplanationResultSchema = z.object({
  summary: z.string(),
  categories: z.array(AuditCategoryExplanationSchema),
  missing_evidence: z.array(z.string()),
  top_priorities: z.array(z.string()),
})

export type AuditExplanationResultOutput = z.infer<typeof AuditExplanationResultSchema>

// Full merged shape returned to the client: deterministic fields + AI explanation fields.
export const AuditCategorySchema = z.object({
  key: z.string(),
  name: z.string(),
  score: z.number().nullable(),
  maxScore: z.number(),
  weight: z.number(),
  explanation: z.string(),
  issues: z.array(z.string()),
  severity: z.enum(['critical', 'major', 'minor']),
  fix: z.string(),
  example: z.string(),
  priority: z.number(),
})

export const AuditResultSchema = z.object({
  overall_score: z.number(),
  summary: z.string(),
  categories: z.array(AuditCategorySchema),
  missing_evidence: z.array(z.string()),
  top_priorities: z.array(z.string()),
})

export type AuditResultOutput = z.infer<typeof AuditResultSchema>

// ── PortfolioContent ──────────────────────────────────────────────────────────
export const PortfolioContentSchema = z.object({
  hero: z.object({
    headline: z.string(),
    subheadline: z.string(),
    tagline: z.string(),
    headshotUrl: z.string().nullable().optional(),
    heroImageUrl: z.string().nullable().optional(),
  }),
  recruiterSummary: z.string().nullable().optional(),
  featuredResult: z.string().nullable().optional(),
  // Theme customization - stored alongside content so it travels with the portfolio
  accentColor: z.string().nullable().optional(),
  about: z.object({
    bio: z.string(),
    values: z.array(z.string()),
  }),
  skills: z.array(z.object({
    name: z.string(),
    level: z.string(),
    category: z.string(),
  })),
  experience: z.array(z.object({
    company: z.string(),
    role: z.string(),
    period: z.string(),
    bullets: z.array(z.string()),
    metrics: z.array(z.string()),
  })),
  projects: z.array(z.object({
    title: z.string(),
    role: z.string(),
    summary: z.string().nullable().optional(),
    problem: z.string(),
    process: z.string(),
    outcome: z.string(),
    metrics: z.array(z.string()),
    links: z.array(z.object({ label: z.string(), url: z.string() })),
    tags: z.array(z.string()).nullable().optional(),
    imageUrl: z.string().nullable().optional(),
  })),
  proof: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })),
  contact: z.object({
    email: z.string().nullable().optional(),
    linkedin: z.string().nullable().optional(),
    github: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
  }),
  cta: z.object({
    headline: z.string(),
    buttonLabel: z.string(),
  }),
})

export type PortfolioContentOutput = z.infer<typeof PortfolioContentSchema>

// ── RecruiterSummary ──────────────────────────────────────────────────────────
export const RecruiterSummarySchema = z.object({
  headline: z.string(),
  summary: z.string(),
  top_skills: z.array(z.string()),
  key_achievements: z.array(z.string()),
  best_project: z.string(),
  contact_cta: z.string(),
})

export type RecruiterSummaryOutput = z.infer<typeof RecruiterSummarySchema>

// ── StructuredJobData ────────────────────────────────────────────────────────
export const StructuredJobDataSchema = z.object({
  responsibilities: z.array(z.string()),
  required_skills: z.array(z.string()),
  preferred_skills: z.array(z.string()),
  experience_requirements: z.array(z.string()),
  education_requirements: z.array(z.string()),
  keywords: z.array(z.string()),
  company_info: z.string().nullable(),
  benefits: z.array(z.string()),
  domain: z.string().nullable(),
  risk_flags: z.array(z.string()),
})

export type StructuredJobDataOutput = z.infer<typeof StructuredJobDataSchema>

// ── TailoredBullet ────────────────────────────────────────────────────────────
export const TailoredBulletSchema = z.object({
  original: z.string().nullable(),
  tailored: z.string(),
  change_type: z.enum(['rewritten', 'reordered', 'new', 'unchanged']),
  reason: z.string(),
  source_evidence: z.string().nullable(),
  needs_user_input: z.boolean(),
  placeholder: z.string().nullable().optional(),
  accepted: z.boolean(),
})

// ── TailoredExperience ────────────────────────────────────────────────────────
export const TailoredExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  period: z.string(),
  original_bullets: z.array(z.string()),
  tailored_bullets: z.array(TailoredBulletSchema),
})

// ── StarEvidence ──────────────────────────────────────────────────────────────
export const StarEvidenceSchema = z.object({
  question_theme: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  source_project: z.string(),
})

// ── InterviewBrief ────────────────────────────────────────────────────────────
export const InterviewBriefSchema = z.object({
  role_themes: z.array(z.string()),
  behavioral_questions: z.array(z.string()),
  project_questions: z.array(z.string()),
  star_evidence: z.array(StarEvidenceSchema),
  skill_gaps_to_address: z.array(z.string()),
  questions_to_ask: z.array(z.string()),
  company_research_placeholders: z.array(z.string()),
})

export type InterviewBriefOutput = z.infer<typeof InterviewBriefSchema>

// ── TruthEntry ────────────────────────────────────────────────────────────────
export const TruthEntrySchema = z.object({
  statement: z.string(),
  source_text: z.string(),
  source_location: z.string(),
  change_type: z.enum(['rewritten', 'reordered', 'new_from_source', 'fabrication_risk']),
  evidence_present: z.boolean(),
  requires_confirmation: z.boolean(),
  user_confirmed: z.boolean().nullable(),
})

// ── TailoredResumeOutput ──────────────────────────────────────────────────────
export const TailoredResumeSchema = z.object({
  professional_summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(TailoredExperienceSchema),
  recommended_projects: z.array(z.string()),
  portfolio_headline: z.string().nullable(),
  recruiter_summary: z.string().nullable(),
  cover_letter: z.string().nullable(),
  recruiter_note: z.string().nullable(),
  truth_map: z.array(TruthEntrySchema),
  interview_brief: InterviewBriefSchema.nullable(),
})

export type TailoredResumeOutput = z.infer<typeof TailoredResumeSchema>

// ── AtsReportOutput ───────────────────────────────────────────────────────────
export const AtsIssueSchema = z.object({
  type: z.enum(['formatting', 'content', 'keyword', 'structure']),
  severity: z.enum(['critical', 'warning', 'info']),
  description: z.string(),
  fix: z.string(),
})

export const KeywordCoverageSchema = z.object({
  keyword: z.string(),
  present: z.boolean(),
  supported: z.boolean(),
  context: z.string().nullable(),
})

export const AtsReportSchema = z.object({
  overall_score: z.number().min(0).max(100),
  text_extractable: z.boolean(),
  contact_detected: z.boolean(),
  headings_recognized: z.boolean(),
  dates_parseable: z.boolean(),
  keyword_coverage: z.array(KeywordCoverageSchema),
  issues: z.array(AtsIssueSchema),
  machine_preview: z.object({
    name: z.string().nullable(),
    contact: z.string().nullable(),
    headings: z.array(z.string()),
    experience_entries: z.number(),
    education_entries: z.number(),
    skills_section_found: z.boolean(),
    estimated_parse_quality: z.enum(['good', 'fair', 'poor']),
  }),
  checked_at: z.string(),
})

export type AtsReportOutput = z.infer<typeof AtsReportSchema>

// ── MatchExplanation ──────────────────────────────────────────────────────────
export const MatchExplanationSchema = z.object({
  score_justification: z.string(),
  top_strength: z.string(),
  primary_gap: z.string(),
  recommended_action: z.string(),
})

export type MatchExplanationOutput = z.infer<typeof MatchExplanationSchema>
