import type { ParsedResumeOutput } from '@/lib/ai/schemas'
import {
  computeProofScore,
  type ProofScoreCategoryKey,
} from './engine.ts'

export interface PublicProofScoreCategory {
  key: ProofScoreCategoryKey
  name: string
  score: number
  weight: number
  severity: 'critical' | 'major' | 'minor'
  priority: number
  gated: boolean
  evidence: string[] | null
  explanation: string | null
  fix: string | null
  example: string | null
}

export interface PublicProofScoreResult {
  overallScore: number
  summary: string
  targetRole: string | null
  categories: PublicProofScoreCategory[]
}

interface FixCopy {
  explanation: string
  fix: string
  example: string
}

function excerpt(value: string | null | undefined, max = 180): string {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? ''
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1).trimEnd()}…`
}

function severityFor(score: number): PublicProofScoreCategory['severity'] {
  if (score < 40) return 'critical'
  if (score < 70) return 'major'
  return 'minor'
}

function fixCopyFor(
  key: ProofScoreCategoryKey,
  parsed: ParsedResumeOutput,
  targetRole: string,
): FixCopy {
  const recentRole = excerpt(parsed.experience[0]?.role)
  const firstSkill = excerpt(parsed.skills[0])
  const weakBullet = excerpt(parsed.weak_bullets[0] ?? parsed.experience.flatMap((item) => item.bullets)[0])
  const firstProject = excerpt(parsed.projects[0]?.title)

  switch (key) {
    case 'role_positioning':
      return {
        explanation: 'A reviewer should be able to tell which role you want and what supported strength you bring within the first line.',
        fix: targetRole
          ? `Write a one-line headline that names “${targetRole}” and one specialty your resume already proves. Do not add a specialty just because it appears in a job description.`
          : 'Choose one target role, then write a one-line headline that names it and one specialty your resume already proves.',
        example: `${targetRole || '[Target role]'} | ${firstSkill || '[specialty supported by your experience]'}`,
      }
    case 'first_impression':
      return {
        explanation: 'A clear summary gives a reviewer enough context to interpret the experience that follows instead of making them infer your direction.',
        fix: 'Use two short sentences: first name your current level and focus; then point to one result or scope that is already documented below. Remove generic adjectives you cannot substantiate.',
        example: `${recentRole || '[Current role or level]'} focused on ${firstSkill || '[supported specialty]'}. [Add one verified result, project, or scope from the resume.]`,
      }
    case 'target_role_alignment':
      return {
        explanation: 'The target role is easier to recognize when its core language is supported by concrete experience, not merely copied into a skills list.',
        fix: `Compare the resume with several ${targetRole || 'target-role'} descriptions. Add a missing term only where a real bullet or project already demonstrates it, and keep unsupported keywords out.`,
        example: 'Instead of adding “[keyword]” alone, write: “[Action using that skill] to [solve a real problem], resulting in [verified outcome].”',
      }
    case 'evidence_strength':
      return {
        explanation: 'Responsibility-only bullets tell a reviewer what you were around; evidence bullets show what you actually did and what changed.',
        fix: 'Rewrite one vague bullet at a time as action + context + verified result. If the result is unknown, state truthful scope or deliverable instead of inventing a number.',
        example: weakBullet
          ? `Before: “${weakBullet}” → Draft: “[Specific action] for [real scope], resulting in [verified outcome or concrete deliverable].”`
          : 'Draft: “[Specific action] for [real scope], resulting in [verified outcome or concrete deliverable].”',
      }
    case 'quantified_impact':
      return {
        explanation: 'Numbers make scope and outcomes easier to verify, but a made-up metric is worse than no metric at all.',
        fix: 'For each result, check whether you know a real count, percentage, time span, frequency, audience size, or dollar amount. Add only the exact figures you can defend; otherwise use concrete non-numeric scope.',
        example: weakBullet
          ? `“${weakBullet}” → “[Action] across [known scope] over [known period], resulting in [verified change].”`
          : '“[Action] across [known scope] over [known period], resulting in [verified change].”',
      }
    case 'project_depth':
      return {
        explanation: 'A project title proves very little by itself. Reviewers need the problem, your decisions, and the outcome to judge depth.',
        fix: 'Expand the strongest project into four parts: the problem, your role, the decisions or process you owned, and the verified outcome. Mark unknown outcomes as missing rather than filling them in.',
        example: `${firstProject || '[Project name]'} — Problem: [real context]. My role: [your contribution]. Process: [key decisions]. Outcome: [verified result or “not measured”].`,
      }
    case 'case_study_quality':
      return {
        explanation: 'This resume-only audit found no finished portfolio case study to verify, so this category starts at zero rather than guessing at quality.',
        fix: 'Turn one well-supported project into a case study with problem, process, outcome, and proof. A link, screenshot, artifact, or exact result can be proof; omit anything you cannot substantiate.',
        example: `${firstProject || '[Strongest project]'} — [Problem] → [What you did and why] → [Verified outcome] → [Link or artifact, if available].`,
      }
    case 'credibility_signals':
      return {
        explanation: 'Education, certifications, and professional links make important claims easier for a reviewer to check.',
        fix: 'Add the relevant education, current certifications, and professional links you actually have. Leave absent credentials absent; never use “in progress” unless that is true.',
        example: 'Credentials: [verified degree or certification]. Links: [LinkedIn, GitHub, portfolio, or work sample you control].',
      }
    case 'contact_readiness':
      return {
        explanation: 'Strong evidence cannot create an opportunity if the reviewer cannot reliably contact you or inspect your work.',
        fix: 'Place one professional email and at least one relevant professional link in a clearly labeled header. Test every link in a private browser window.',
        example: 'Email: [professional address] · [LinkedIn, GitHub, or portfolio URL]',
      }
    case 'keyword_support':
      return {
        explanation: 'A focused, supported vocabulary helps both people and screening software connect your experience to the role.',
        fix: `Group the skills you genuinely used, then echo the most relevant ones inside the bullets that prove them. Avoid keyword stuffing and remove any skill you could not discuss in an interview.`,
        example: `${targetRole || '[Target role]'} skills: ${parsed.skills.slice(0, 4).map((skill) => excerpt(skill)).filter(Boolean).join(', ') || '[supported skills]'}.`,
      }
    case 'presentation_clarity':
      return {
        explanation: 'Consistent dates and scannable bullet counts help a reviewer understand your progression without reconstructing the timeline.',
        fix: 'Use one date format throughout, include dates for every role, and keep each role to the most relevant 1–8 bullets. Move overflow detail into a project or case study.',
        example: `${recentRole || '[Role]'} · [Mon YYYY–Mon YYYY]\n• [Most relevant evidence]\n• [Second strongest evidence]`,
      }
  }
}

/**
 * Public ProofScore is deterministic after the resume has been parsed: the existing
 * arithmetic engine decides every number, while fixed templates explain only the two
 * lowest categories. The remaining nine fixes are not serialized to the browser.
 */
export function buildPublicProofScore(
  parsed: ParsedResumeOutput,
  requestedTargetRole = '',
  industry = '',
): PublicProofScoreResult {
  const targetRole = requestedTargetRole.trim() || parsed.experience[0]?.role?.trim() || ''
  const computed = computeProofScore(parsed, null, targetRole, industry.trim(), true)

  const numeric = computed.categories.map((category, originalIndex) => ({
    ...category,
    // Resume-only input cannot produce the portfolio-only case-study score. Showing 0
    // names the missing proof honestly and lets the public tool keep all 11 scores visible.
    score: category.score ?? 0,
    originalIndex,
  }))

  const ranked = [...numeric].sort((a, b) =>
    a.score - b.score || b.weight - a.weight || a.originalIndex - b.originalIndex
  )
  const priorities = new Map(ranked.map((category, index) => [category.key, index + 1]))
  const unlockedKeys = new Set(ranked.slice(0, 2).map((category) => category.key))

  const categories: PublicProofScoreCategory[] = numeric.map((category) => {
    const gated = !unlockedKeys.has(category.key)
    const copy = gated ? null : fixCopyFor(category.key, parsed, targetRole)
    const evidence = category.key === 'case_study_quality' && category.score === 0
      ? ['No finished portfolio case study was supplied in this resume-only audit.']
      : category.evidence.map((item) => excerpt(item, 260))

    return {
      key: category.key,
      name: category.name,
      score: category.score,
      weight: category.weight,
      severity: severityFor(category.score),
      priority: priorities.get(category.key) ?? 11,
      gated,
      evidence: gated ? null : evidence,
      explanation: copy?.explanation ?? null,
      fix: copy?.fix ?? null,
      example: copy?.example ?? null,
    }
  })

  const overallScore = Math.round(
    numeric.reduce((total, category) => total + category.score * category.weight, 0) / 100
  )
  const [first, second] = ranked
  const summary = `Your biggest proof gaps are ${first.name.toLowerCase()} (${first.score}/100) and ${second.name.toLowerCase()} (${second.score}/100). Start there: improving the weakest evidence usually makes the rest of the resume easier to trust. This score reflects only what your resume currently shows; it does not predict interviews or offers.`

  return {
    overallScore,
    summary,
    targetRole: targetRole || null,
    categories,
  }
}
