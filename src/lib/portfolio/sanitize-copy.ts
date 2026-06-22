import type { PortfolioContentOutput } from '@/lib/ai/schemas'

// Defense-in-depth, not the primary control: the portfolio-generation prompt already
// instructs the model never to use these words/openers, but a real eval run (see
// evals/results/) showed occasional stochastic leaks at temperature 0.4 ("dynamic",
// "innovative", "impactful" slipped through on a handful of fixtures). Rather than drive
// temperature to 0 (which would flatten the copywriting this prompt exists to produce) or
// treat an isolated word choice as a fabrication-severity issue, strip it deterministically
// after generation so a stochastic miss never reaches a user's published portfolio.

const GENERIC_ADJECTIVES = [
  'passionate', 'results-driven', 'innovative', 'dynamic', 'impactful',
]

const SENTENCE_OPENERS: Array<[RegExp, string]> = [
  [/\bas a result,\s*/gi, ''],
  [/\bthis led to\s*/gi, ''],
  [/\bwe were able to\s*/gi, ''],
]

function scrubText(text: string): string {
  let result = text
  for (const word of GENERIC_ADJECTIVES) {
    result = result.replace(new RegExp(`\\b${word}\\b,?\\s*`, 'gi'), '')
  }
  for (const [pattern, replacement] of SENTENCE_OPENERS) {
    result = result.replace(pattern, replacement)
  }
  return result
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/^[a-z]/, (c) => c.toUpperCase())
}

function scrubArray(items: string[] | undefined): string[] | undefined {
  return items?.map(scrubText)
}

/** Walks the free-text fields of a generated portfolio and removes forbidden generic
 *  adjectives / banned sentence openers the prompt already told the model not to use. */
export function sanitizePortfolioCopy(content: PortfolioContentOutput): PortfolioContentOutput {
  return {
    ...content,
    hero: {
      ...content.hero,
      headline: scrubText(content.hero.headline),
      subheadline: scrubText(content.hero.subheadline),
      tagline: scrubText(content.hero.tagline),
    },
    recruiterSummary: content.recruiterSummary ? scrubText(content.recruiterSummary) : content.recruiterSummary,
    featuredResult: content.featuredResult ? scrubText(content.featuredResult) : content.featuredResult,
    about: {
      ...content.about,
      bio: scrubText(content.about.bio),
      values: scrubArray(content.about.values) ?? [],
    },
    experience: content.experience.map((exp) => ({ ...exp, bullets: scrubArray(exp.bullets) ?? [] })),
    projects: content.projects.map((proj) => ({
      ...proj,
      summary: proj.summary ? scrubText(proj.summary) : proj.summary,
      problem: scrubText(proj.problem),
      process: scrubText(proj.process),
      outcome: scrubText(proj.outcome),
    })),
    cta: { ...content.cta, headline: scrubText(content.cta.headline) },
  }
}
