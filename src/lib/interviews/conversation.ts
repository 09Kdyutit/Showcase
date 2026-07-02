// Shared reconstruction of the ACTUAL interview conversation from transcript segments.
// A live interview is a free-flowing exchange that never maps onto the fixed planned
// questions, so both the analyzer (to produce per-answer coaching for every real answer)
// and the results page (to display the real Q&A) must derive exchanges the same way —
// keyed by the interviewer segment id so coaching maps 1:1 to what was actually asked.

export interface RawSegment {
  id: string
  speaker: string
  content: string
}

export interface Exchange {
  /** Stable key for this exchange = the interviewer segment id that opened it (or the
   *  first candidate segment id if the candidate spoke first). Used as the answerAssessment
   *  questionId so results can attach coaching to the right exchange. */
  id: string
  question: string
  answer: string
}

// Strip anything that should never reach the candidate or the analyzer: leaked internal
// segment-id anchors like "(07caaae3)" and timing cues like "[[CLOCK …]]" / "[DIRECTOR'S NOTE …]".
export function cleanSpoken(text: string): string {
  return (text ?? '')
    .replace(/\[\[[\s\S]*?\]\]/g, '')
    .replace(/\[(?:director'?s note|stage direction|wrap now|clock)[\s\S]*?\]/gi, '')
    .replace(/\s*\(\s*[0-9a-f]{6,}(?:\s*,\s*[0-9a-f]{6,})*\s*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Pair each interviewer turn with the candidate answer(s) that follow it. Segments are
// assumed to be in chronological order. Only exchanges the candidate actually answered are
// returned (drops the closing "any questions for me?" turn and unanswered prompts).
export function buildExchanges(segments: RawSegment[]): Exchange[] {
  const pairs: Exchange[] = []
  let cur: Exchange | null = null
  for (const seg of segments) {
    const content = cleanSpoken(seg.content)
    if (!content) continue
    if (seg.speaker === 'interviewer') {
      if (cur) pairs.push(cur)
      cur = { id: seg.id, question: content, answer: '' }
    } else if (seg.speaker === 'candidate') {
      if (!cur) cur = { id: seg.id, question: '', answer: '' }
      cur.answer += (cur.answer ? ' ' : '') + content
    }
  }
  if (cur) pairs.push(cur)
  return pairs.filter((p) => p.answer.trim().length > 0)
}
