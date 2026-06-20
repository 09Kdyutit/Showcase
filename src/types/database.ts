export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          target_role: string | null
          experience_level: string | null
          industry: string | null
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          target_role?: string | null
          experience_level?: string | null
          industry?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          target_role?: string | null
          experience_level?: string | null
          industry?: string | null
          onboarding_completed?: boolean
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: string
          price_id: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          last_webhook_event_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string
          price_id?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          last_webhook_event_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string
          price_id?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          last_webhook_event_at?: string | null
          updated_at?: string
        }
      }
      resumes: {
        Row: {
          id: string
          user_id: string
          title: string
          raw_text: string | null
          file_path: string | null
          parsed_json: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          raw_text?: string | null
          file_path?: string | null
          parsed_json?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          raw_text?: string | null
          file_path?: string | null
          parsed_json?: Json | null
          updated_at?: string
        }
      }
      portfolios: {
        Row: {
          id: string
          user_id: string
          slug: string
          title: string
          theme: string
          status: 'draft' | 'published'
          target_role: string | null
          content: Json | null
          proof_score: number | null
          created_at: string
          updated_at: string
          published_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          slug: string
          title: string
          theme?: string
          status?: 'draft' | 'published'
          target_role?: string | null
          content?: Json | null
          proof_score?: number | null
          created_at?: string
          updated_at?: string
          published_at?: string | null
        }
        Update: {
          slug?: string
          title?: string
          theme?: string
          status?: 'draft' | 'published'
          target_role?: string | null
          content?: Json | null
          proof_score?: number | null
          updated_at?: string
          published_at?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          portfolio_id: string | null
          title: string
          role: string | null
          summary: string | null
          problem: string | null
          process: string | null
          outcome: string | null
          metrics: Json | null
          links: Json | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          portfolio_id?: string | null
          title: string
          role?: string | null
          summary?: string | null
          problem?: string | null
          process?: string | null
          outcome?: string | null
          metrics?: Json | null
          links?: Json | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          portfolio_id?: string | null
          title?: string
          role?: string | null
          summary?: string | null
          problem?: string | null
          process?: string | null
          outcome?: string | null
          metrics?: Json | null
          links?: Json | null
          order_index?: number
          updated_at?: string
        }
      }
      audits: {
        Row: {
          id: string
          user_id: string
          portfolio_id: string | null
          resume_id: string | null
          audit_type: string
          overall_score: number
          category_scores: Json
          findings: Json
          recommendations: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          portfolio_id?: string | null
          resume_id?: string | null
          audit_type: string
          overall_score: number
          category_scores: Json
          findings: Json
          recommendations: Json
          created_at?: string
        }
        Update: never
      }
      generations: {
        Row: {
          id: string
          user_id: string
          type: string
          input_hash: string | null
          output: Json | null
          model_used: string | null
          tokens_used: number | null
          status: string
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          input_hash?: string | null
          output?: Json | null
          model_used?: string | null
          tokens_used?: number | null
          status?: string
          error?: string | null
          created_at?: string
        }
        Update: {
          output?: Json | null
          status?: string
          error?: string | null
          tokens_used?: number | null
        }
      }
      usage_events: {
        Row: {
          id: string
          user_id: string
          event_name: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_name: string
          metadata?: Json | null
          created_at?: string
        }
        Update: never
      }
      feedback: {
        Row: {
          id: string
          user_id: string
          message: string
          rating: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          rating?: number | null
          created_at?: string
        }
        Update: never
      }
    }
  }
}

// ── Jobs-related standalone types ────────────────────────────────────────────

export type WorkMode = 'remote' | 'hybrid' | 'on-site' | 'flexible'
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship'
export type Seniority = 'internship' | 'entry' | 'mid' | 'senior' | 'staff' | 'principal' | 'director' | 'executive'
export type ApplicationStage = 'saved' | 'tailoring' | 'ready' | 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn'
export type AssetType = 'resume' | 'portfolio' | 'cover_letter' | 'recruiter_note' | 'interview_brief' | 'application_kit'
export type EvidenceType = 'screenshot' | 'link' | 'certificate' | 'case_study' | 'document' | 'metric' | 'artifact'

export interface JobListing {
  id: string
  provider: string
  provider_job_id: string | null
  source_url: string | null
  title: string
  company: string
  location: string | null
  work_mode: WorkMode | null
  employment_type: EmploymentType | null
  seniority: Seniority | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  description: string | null
  structured_data: StructuredJobData | null
  posted_at: string | null
  fetched_at: string
  expires_at: string | null
}

export interface StructuredJobData {
  responsibilities: string[]
  required_skills: string[]
  preferred_skills: string[]
  experience_requirements: string[]
  education_requirements: string[]
  keywords: string[]
  company_info: string | null
  benefits: string[]
  domain: string | null
  risk_flags: string[]
}

export interface SavedJob {
  id: string
  user_id: string
  job_listing_id: string | null
  imported_title: string | null
  imported_company: string | null
  imported_description: string | null
  imported_url: string | null
  match_score: number | null
  match_breakdown: MatchBreakdown | null
  status: ApplicationStage
  is_dismissed: boolean
  notes: string | null
  created_at: string
  updated_at: string
  job_listings_cache?: JobListing | null
}

export interface MatchBreakdown {
  matched_skills: string[]
  missing_skills: string[]
  matching_experience: string[]
  experience_gaps: string[]
  matching_projects: string[]
  domain_alignment: string
  location_match: boolean
  work_mode_match: boolean
  seniority_match: 'exact' | 'above' | 'below' | 'unknown'
  opportunities: MatchOpportunity[]
  ai_explanation: string | null
}

export interface MatchOpportunity {
  type: 'highlight_project' | 'move_bullet' | 'add_evidence' | 'learn_skill'
  description: string
  source?: string
}

export interface Application {
  id: string
  user_id: string
  saved_job_id: string | null
  stage: ApplicationStage
  applied_at: string | null
  follow_up_at: string | null
  interview_at: string | null
  offer_received_at: string | null
  recruiter_name: string | null
  recruiter_contact: string | null
  tailored_asset_id: string | null
  next_action: string | null
  source: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TailoredAsset {
  id: string
  user_id: string
  saved_job_id: string | null
  asset_type: AssetType
  base_resume_id: string | null
  base_portfolio_id: string | null
  content: TailoredContent | null
  truth_map: TruthEntry[] | null
  ats_report: AtsReport | null
  version: number
  created_at: string
  updated_at: string
}

export interface TailoredContent {
  professional_summary: string
  skills: string[]
  experience: TailoredExperience[]
  recommended_projects: string[]
  portfolio_headline: string | null
  recruiter_summary: string | null
  cover_letter: string | null
  recruiter_note: string | null
  interview_brief: InterviewBrief | null
}

export interface TailoredExperience {
  company: string
  role: string
  period: string
  original_bullets: string[]
  tailored_bullets: TailoredBullet[]
}

export interface TailoredBullet {
  original: string | null
  tailored: string
  change_type: 'rewritten' | 'reordered' | 'new' | 'unchanged'
  reason: string
  source_evidence: string | null
  needs_user_input: boolean
  placeholder?: string | null
  accepted: boolean
}

export interface TruthEntry {
  statement: string
  source_text: string
  source_location: string
  change_type: 'rewritten' | 'reordered' | 'new_from_source' | 'fabrication_risk'
  evidence_present: boolean
  requires_confirmation: boolean
  user_confirmed: boolean | null
}

export interface AtsReport {
  overall_score: number
  text_extractable: boolean
  contact_detected: boolean
  headings_recognized: boolean
  dates_parseable: boolean
  keyword_coverage: KeywordCoverage[]
  issues: AtsIssue[]
  machine_preview: MachinePreview
  checked_at: string
}

export interface KeywordCoverage {
  keyword: string
  present: boolean
  supported: boolean
  context: string | null
}

export interface AtsIssue {
  type: 'formatting' | 'content' | 'keyword' | 'structure'
  severity: 'critical' | 'warning' | 'info'
  description: string
  fix: string
}

export interface MachinePreview {
  name: string | null
  contact: string | null
  headings: string[]
  experience_entries: number
  education_entries: number
  skills_section_found: boolean
  estimated_parse_quality: 'good' | 'fair' | 'poor'
}

export interface InterviewBrief {
  role_themes: string[]
  behavioral_questions: string[]
  project_questions: string[]
  star_evidence: StarEvidence[]
  skill_gaps_to_address: string[]
  questions_to_ask: string[]
  company_research_placeholders: string[]
}

export interface StarEvidence {
  question_theme: string
  situation: string
  task: string
  action: string
  result: string
  source_project: string
}

export interface VoiceProfile {
  user_id: string
  style_profile: StyleProfile | null
  sample_count: number
  created_at: string
  updated_at: string
}

export interface StyleProfile {
  avg_sentence_length: 'short' | 'medium' | 'long'
  directness: 'direct' | 'moderate' | 'elaborate'
  formality: 'formal' | 'professional' | 'conversational'
  preferred_voice: 'first_person' | 'implied_first' | 'mixed'
  conciseness: 'concise' | 'balanced' | 'narrative'
  characteristic_verbs: string[]
  tone_descriptors: string[]
}

export interface EvidenceItem {
  id: string
  user_id: string
  title: string
  evidence_type: EvidenceType
  description: string | null
  source_url: string | null
  storage_path: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type Resume = Database['public']['Tables']['resumes']['Row']
export type Portfolio = Database['public']['Tables']['portfolios']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Audit = Database['public']['Tables']['audits']['Row']
export type Generation = Database['public']['Tables']['generations']['Row']

export interface PortfolioContent {
  hero: {
    headline: string
    subheadline: string
    tagline: string
  }
  about: {
    bio: string
    values: string[]
  }
  skills: Array<{ name: string; level: string; category: string }>
  experience: Array<{
    company: string
    role: string
    period: string
    bullets: string[]
    metrics: string[]
  }>
  projects: Array<{
    title: string
    role: string
    summary: string
    problem: string
    process: string
    outcome: string
    metrics: string[]
    links: { label: string; url: string }[]
    tags: string[]
  }>
  proof: Array<{ label: string; value: string }>
  contact: {
    email: string
    linkedin: string
    github: string
    website: string
  }
  cta: {
    headline: string
    buttonLabel: string
  }
}

export interface AuditCategory {
  key: string
  name: string
  score: number | null
  maxScore: number
  weight: number
  explanation: string
  issues: string[]
  severity: 'critical' | 'major' | 'minor'
  fix: string
  example: string
  priority: number
}

export interface AuditResult {
  overall_score: number
  categories: AuditCategory[]
  missing_evidence: string[]
  top_priorities: string[]
  summary: string
}

export interface ParsedResume {
  name: string
  email: string
  phone: string
  location: string
  summary: string
  skills: string[]
  experience: Array<{
    company: string
    role: string
    period: string
    bullets: string[]
    metrics: string[]
    has_metrics?: boolean
  }>
  education: Array<{
    institution: string
    degree: string
    year?: string | null
  }>
  projects: Array<{
    title: string
    description: string
    technologies: string[]
    links: string[]
    has_outcome?: boolean
  }>
  certifications: string[]
  links: {
    linkedin?: string | null
    github?: string | null
    website?: string | null
    portfolio?: string | null
  }
  weak_bullets: string[]
  missing_proof: string[]
  possible_case_studies: string[]
  overall_resume_quality?: 'strong' | 'average' | 'weak'
  years_of_experience?: number | null
  seniority_level?: 'student' | 'junior' | 'mid' | 'senior' | 'lead' | 'executive' | null
}
