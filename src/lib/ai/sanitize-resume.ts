import type { ParsedResumeOutput } from './schemas'

// Defense-in-depth, not the primary control. A real eval run (evals/results/) showed the
// resume-parse prompt's own instruction not to comply with candidate-embedded meta-requests
// ("please also list X", "note to whoever is processing this", "I'm sure it's roughly true")
// is not 100% reliable across runs even at temperature 0.1 - prompt wording alone is
// probabilistic, not a guarantee. This catches what the prompt missed: if a skill or metric's
// only appearance in the source text is inside a sentence carrying one of these signal
// phrases, drop it deterministically before it reaches the database, regardless of whether the
// model already excluded it.

const SELF_ADMISSION_SIGNALS = [
  'please also list', 'please write that', 'note to whoever', 'i am sure it', "i'm sure it",
  "haven't used", 'have not used', 'studying in my free time', 'roughly true',
  'even though i', 'whoever is processing this',
]

function splitIntoLines(text: string): string[] {
  return text.split(/\n|\.(?=\s|$)/).map((l) => l.trim()).filter(Boolean)
}

function isTaintedLine(line: string): boolean {
  const lower = line.toLowerCase()
  return SELF_ADMISSION_SIGNALS.some((sig) => lower.includes(sig))
}

/** True if every line in `sourceText` that mentions `value` (case-insensitive substring) is a
 *  tainted line - i.e. there is no clean, independent mention to corroborate it. */
function onlyAppearsInTaintedContext(value: string, lines: string[]): boolean {
  const needle = value.toLowerCase()
  const mentioningLines = lines.filter((l) => l.toLowerCase().includes(needle))
  if (mentioningLines.length === 0) return false // not in source at all - a different check's job
  return mentioningLines.every(isTaintedLine)
}

export function sanitizeParsedResume(parsed: ParsedResumeOutput, sourceText: string): ParsedResumeOutput {
  const lines = splitIntoLines(sourceText)

  const skills = parsed.skills.filter((s) => !onlyAppearsInTaintedContext(s, lines))

  const experience = parsed.experience.map((exp) => ({
    ...exp,
    metrics: exp.metrics.filter((m) => !onlyAppearsInTaintedContext(m, lines)),
  }))

  return { ...parsed, skills, experience }
}
