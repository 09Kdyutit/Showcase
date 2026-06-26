import { AtsReportSchema, type AtsReportOutput } from '../schemas'
import { definePrompt } from './types'

export interface AtsCheckInput {
  resumeText: string
  jobKeywords: string[]
}

const MAX_INPUT_CHARACTERS = 8000

function userMessage(input: AtsCheckInput): string {
  const { resumeText, jobKeywords } = input
  return `TASK: review this resume for common ATS (Applicant Tracking System) parsing risks.

IMPORTANT LIMITATIONS  -  state these, don't paper over them:
- This is a text-based analysis, not a real ATS parse
- Results indicate likely parsing behavior, NOT guaranteed ATS passage
- Different ATS systems behave differently  -  this checks for common risks only
- Report what was tested, not what is guaranteed

RESUME TEXT:
${resumeText.slice(0, MAX_INPUT_CHARACTERS)}

JOB KEYWORDS TO CHECK:
${jobKeywords.join(', ')}

WHAT TO ASSESS:
1. Can text be extracted? (Is there readable text content?)
2. Is contact information detectable? (Name, email, phone in standard location)
3. Are section headings using standard terms? (Experience, Education, Skills, etc.)
4. Are dates in a parseable format? (MM/YYYY or similar)
5. For each keyword: is it present in the text, and is it supported by real experience?
6. Any formatting issues that commonly cause parsing problems?
7. Is important information outside the main content area (headers/footers)?

KEYWORD SUPPORT RULE:
- A keyword is "present" if the exact term or close variant appears in the text
- A keyword is "supported" if it appears in context showing real experience, not just listed
- Never mark a keyword as supported if it only appears as a list item without evidence

Return JSON:
{
  "overall_score": number (0-100, represents ATS-friendliness  -  not hiring probability),
  "text_extractable": boolean,
  "contact_detected": boolean,
  "headings_recognized": boolean,
  "dates_parseable": boolean,
  "keyword_coverage": [
    { "keyword": string, "present": boolean, "supported": boolean, "context": "Brief quote showing context, or null if absent" }
  ],
  "issues": [
    { "type": "formatting" | "content" | "keyword" | "structure", "severity": "critical" | "warning" | "info", "description": string, "fix": string }
  ],
  "machine_preview": {
    "name": "Detected name or null",
    "contact": "Detected contact info or null",
    "headings": ["List of detected section headings"],
    "experience_entries": number,
    "education_entries": number,
    "skills_section_found": boolean,
    "estimated_parse_quality": "good" | "fair" | "poor"
  },
  "checked_at": "${new Date().toISOString()}"
}`
}

export const atsCheckPrompt = definePrompt<AtsCheckInput, AtsReportOutput>({
  id: 'ats-check',
  version: '2.0.0',
  task: 'Heuristic ATS-parsing-risk review of resume text against a target job\'s keywords. Explicitly not a real ATS simulation or hiring-probability score.',
  routes: ['/api/ats/check'],
  modelTier: 'fast',
  temperature: 0.1,
  maxOutputTokens: 3000,
  maxInputCharacters: MAX_INPUT_CHARACTERS,
  outputSchema: AtsReportSchema,
  schemaName: 'ats_report',
  invariants: [
    'States its own limitations (not a real ATS, not a hiring-probability score)',
    'A keyword is only "supported" if shown in real-experience context, never just listed',
  ],
  reviewPolicy: 'none',
  buildMessages: (input) => [
    { role: 'user', content: userMessage(input) },
  ],
})
