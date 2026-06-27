#!/usr/bin/env node
// Real, live test against the actual OpenAI API (not a mock) — exercises the full
// analysis pipeline end to end: complete a real session with real answers, call the
// real /analyze route, and verify the response is genuinely a valid, schema-shaped
// evaluation with real evidence citations that map back to real transcript segments.
// Analysis runs on OpenAI (gpt-5-mini by default) as of the Gemini->OpenAI interview
// analysis migration; live voice interviews are a separate feature and remain on
// Gemini. Requires OPENAI_API_KEY + the Interview Lab gate flags to be enabled in
// .env.local (GEMINI_PAID_PROJECT_CONFIRMED, GEMINI_INTERVIEW_ENABLED,
// GEMINI_TERMS_COMPATIBILITY_CONFIRMED, INTERVIEW_ANALYSIS_ENABLED) -- those flags are
// Gemini-named for historical reasons but still gate this OpenAI-powered path; see the
// comment in src/lib/interviews/analysis.ts.
import { chromium } from 'playwright'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function callApi(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    let json = null
    try { json = await res.json() } catch {}
    return { status: res.status, body: json }
  }, { method, path, body })
}

async function main() {
  const suffix = Date.now()
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Real Analysis Test')
  await page.fill('input[type=email]', `interview-real-analysis-${suffix}@example.com`)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)

  const createRes = await callApi(page, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Senior Product Manager',
  })
  const sessionId = createRes.body?.data?.id
  record('Setup: real session created', !!sessionId)

  const startRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/start`)
  let nextQ = startRes.body?.data?.firstQuestion
  const answers = [
    'In my last role at a fintech startup, our onboarding completion rate had dropped to 41 percent. I personally led a team of 4 engineers and a designer to redesign the flow, running 12 user interviews myself to find friction points. We shipped an MVP in 3 weeks and completion rate rose to 67 percent, about 200 additional activated users per month.',
    'I disagreed with my engineering lead about shipping a feature without full test coverage. I scheduled a 1:1, presented regression risk data from our last 3 incidents, and proposed shipping behind a flag with monitoring as a compromise. He agreed, and the flag caught a real bug before full rollout.',
  ]
  let i = 0
  const askedQuestionIds = []
  while (nextQ) {
    askedQuestionIds.push(nextQ.id)
    const ansRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/transcript`, { questionId: nextQ.id, answerText: answers[i % answers.length] })
    nextQ = ansRes.body?.data?.nextQuestion
    i++
  }
  await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/complete`)

  const detailBefore = await callApi(page, 'GET', `/api/interviews/sessions/${sessionId}`)
  const realSegmentIds = new Set((detailBefore.body?.data?.transcript ?? []).map((t) => t.id))

  console.log('\n── Real analysis call (OpenAI, gpt-5-mini by default) ──')
  const analyzeRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/analyze`)
  record('Analysis succeeds against the live OpenAI API', analyzeRes.status === 200, `got ${analyzeRes.status}: ${JSON.stringify(analyzeRes.body)?.slice(0, 200)}`)

  const evaluation = analyzeRes.body?.data?.evaluation
  record('Returns a real evaluation row with a numeric overall_score', typeof evaluation?.overall_score === 'number' && evaluation.overall_score >= 0 && evaluation.overall_score <= 100)
  record('Returns a real model name (not fabricated)', /^gpt-/.test(evaluation?.model ?? ''))

  const dimensions = analyzeRes.body?.data?.dimensions ?? []
  record('Returns at least one real dimension score', dimensions.length > 0)
  record('Every dimension has a real evidence explanation (not empty)', dimensions.every((d) => typeof d.explanation === 'string' && d.explanation.length > 10))

  const allCitedSegmentIds = dimensions.flatMap((d) => d.evidenceSegmentIds ?? [])
  record('Every cited evidence segment ID is a REAL segment from this session\'s actual transcript (no fabricated citations)', allCitedSegmentIds.length > 0 && allCitedSegmentIds.every((id) => realSegmentIds.has(id)))

  console.log('\n── Re-fetching the session shows the persisted evaluation ──')
  const detailAfter = await callApi(page, 'GET', `/api/interviews/sessions/${sessionId}`)
  record('The session detail endpoint now returns the real latestEvaluation', detailAfter.body?.data?.latestEvaluation?.overall_score === evaluation?.overall_score)

  await browser.close()
  console.log(`\n  Real Gemini analysis test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
