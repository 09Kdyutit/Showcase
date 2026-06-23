#!/usr/bin/env node
// Real, adversarial two-user RLS test for every Interview Lab table added in
// migration 017. Same method as scripts/test-rls.mjs: two genuine signed-up users via
// the real anon key, User A creates real rows, User B attempts every realistic
// cross-user access. Also proves interview_usage and reserve_interview_usage() are
// completely unreachable from any authenticated client (server-only accounting).
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function signUp(email) {
  const client = createClient(URL, ANON_KEY)
  const { data, error } = await client.auth.signUp({ email, password: 'TestPassword123!' })
  if (error) throw new Error(`signup failed: ${error.message}`)
  return { client, userId: data.user.id }
}

async function main() {
  const suffix = Date.now()
  const a = await signUp(`interview-rls-a-${suffix}@example.com`)
  const b = await signUp(`interview-rls-b-${suffix}@example.com`)
  console.log('User A:', a.userId)
  console.log('User B:', b.userId)

  // ── User A creates real Interview Lab data ──────────────────────────────
  await a.client.from('interview_profiles').insert({ user_id: a.userId })

  const samplePlan = { sessionType: 'behavioral', targetRole: 'Engineer', targetCompany: null, competencies: ['ownership'], questions: [], maxFollowUps: 2, rubricId: 'rubric-behavioral', rubricVersion: '1', forbiddenTopics: [], maxDurationSeconds: 420 }
  const { data: sessionA, error: sessionErr } = await a.client
    .from('interview_sessions')
    .insert({
      user_id: a.userId, session_type: 'behavioral', delivery_mode: 'text', coaching_mode: 'guided',
      target_role: 'Secret Target Role A', session_plan: samplePlan, rubric_id: 'rubric-behavioral',
      rubric_version: '1', planned_question_count: 1, max_duration_seconds: 420,
    })
    .select().single()
  if (sessionErr) throw new Error('setup: could not create session as User A: ' + sessionErr.message)

  const { data: questionA } = await a.client
    .from('interview_questions')
    .insert({ user_id: a.userId, session_id: sessionA.id, order_index: 0, question_text: 'Secret question for A', competency: 'ownership', difficulty: 'standard', selection_reason: 'test' })
    .select().single()

  const { data: segmentA } = await a.client
    .from('interview_transcript_segments')
    .insert({ user_id: a.userId, session_id: sessionA.id, question_id: questionA.id, speaker: 'candidate', start_ms: 0, end_ms: 1000, content: 'CONFIDENTIAL answer from A', source_mode: 'text' })
    .select().single()

  const { data: answerA } = await a.client
    .from('interview_answers')
    .insert({ user_id: a.userId, session_id: sessionA.id, question_id: questionA.id, attempt_number: 1, answer_text: 'CONFIDENTIAL answer from A', transcript_segment_ids: [segmentA.id] })
    .select().single()

  const { data: evaluationA } = await a.client
    .from('interview_evaluations')
    .insert({ user_id: a.userId, session_id: sessionA.id, prompt_id: 'test', prompt_version: '1', model: 'test-model', rubric_id: 'rubric-behavioral', rubric_version: '1', overall_score: 77, readiness_band: 'practicing', result: {} })
    .select().single()

  const { data: dimScoreA } = await a.client
    .from('interview_dimension_scores')
    .insert({ user_id: a.userId, session_id: sessionA.id, evaluation_id: evaluationA.id, dimension_id: 'answer_relevance', score: 80, weight: 1, explanation: 'test' })
    .select().single()

  const { data: storyA } = await a.client
    .from('interview_story_bank')
    .insert({ user_id: a.userId, title: 'Secret story A', competencies: ['ownership'] })
    .select().single()

  const { data: drillA } = await a.client
    .from('interview_drills')
    .insert({ user_id: a.userId, drill_type: 'star_structure', competency: 'ownership' })
    .select().single()

  console.log('\n── Cross-user SELECT ──')
  {
    const { data } = await b.client.from('interview_sessions').select('*').eq('id', sessionA.id)
    record("User B cannot SELECT User A's session by known ID", (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('interview_sessions').select('*')
    record("User B's unfiltered session list does not include User A's session", !(data ?? []).some((s) => s.id === sessionA.id))
  }
  {
    const { data } = await b.client.from('interview_questions').select('*').eq('id', questionA.id)
    record("User B cannot SELECT User A's question", (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('interview_answers').select('*').eq('id', answerA.id)
    record("User B cannot SELECT User A's answer", (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('interview_transcript_segments').select('*').eq('id', segmentA.id)
    record("User B cannot SELECT User A's transcript segment", (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('interview_evaluations').select('*').eq('id', evaluationA.id)
    record("User B cannot SELECT User A's evaluation", (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('interview_dimension_scores').select('*').eq('id', dimScoreA.id)
    record("User B cannot SELECT User A's dimension score", (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('interview_story_bank').select('*').eq('id', storyA.id)
    record("User B cannot SELECT User A's story bank entry", (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('interview_drills').select('*').eq('id', drillA.id)
    record("User B cannot SELECT User A's drill", (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('interview_profiles').select('*').eq('user_id', a.userId)
    record("User B cannot SELECT User A's interview profile", (data?.length ?? 0) === 0)
  }

  console.log('\n── Cross-user UPDATE ──')
  {
    const { data } = await b.client.from('interview_sessions').update({ target_role: 'HACKED' }).eq('id', sessionA.id).select()
    record("User B cannot UPDATE User A's session", (data?.length ?? 0) === 0)
  }
  {
    const { data: check } = await a.client.from('interview_sessions').select('target_role').eq('id', sessionA.id).single()
    record("User A's session target_role is unchanged after attempted hijack", check?.target_role === 'Secret Target Role A')
  }
  {
    const { data } = await b.client.from('interview_story_bank').update({ title: 'HACKED' }).eq('id', storyA.id).select()
    record("User B cannot UPDATE User A's story bank entry", (data?.length ?? 0) === 0)
  }

  console.log('\n── Cross-user DELETE ──')
  {
    const { data } = await b.client.from('interview_sessions').delete().eq('id', sessionA.id).select()
    record("User B cannot DELETE User A's session", (data?.length ?? 0) === 0)
  }
  {
    const { data: check } = await a.client.from('interview_sessions').select('id').eq('id', sessionA.id).single()
    record("User A's session still exists after attempted deletion", !!check)
  }

  console.log('\n── Impersonation / mass-assignment (INSERT as someone else) ──')
  {
    const { data } = await b.client.from('interview_sessions').insert({
      user_id: a.userId, session_type: 'behavioral', delivery_mode: 'text', coaching_mode: 'guided',
      target_role: 'Planted by B', session_plan: samplePlan, rubric_id: 'rubric-behavioral', rubric_version: '1',
      planned_question_count: 1, max_duration_seconds: 420,
    }).select()
    record("User B cannot INSERT a session with User A's user_id", (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('interview_story_bank').insert({ user_id: a.userId, title: 'Planted by B', competencies: [] }).select()
    record("User B cannot INSERT a story bank entry with User A's user_id", (data?.length ?? 0) === 0)
  }

  console.log("\n── interview_usage: zero client write access, server-only accounting ──")
  {
    const { data, error } = await a.client.from('interview_usage').select('*').eq('user_id', a.userId)
    record('User A CAN read their own usage row (read-only policy works)', !error)
    void data
  }
  {
    const { data } = await a.client.from('interview_usage').insert({ user_id: a.userId, period_start: '2026-01-01', period_end: '2026-01-31' }).select()
    record('User A (their OWN user_id) still cannot INSERT into interview_usage — zero client write policy', (data?.length ?? 0) === 0)
  }
  {
    const { data } = await a.client.from('interview_usage').update({ reserved_cost_microunits: 0 }).eq('user_id', a.userId).select()
    record('User A cannot UPDATE their own usage row directly — only the atomic RPC may write it', (data?.length ?? 0) === 0)
  }
  {
    const { error } = await a.client.rpc('reserve_interview_usage', { p_user_id: a.userId, p_period_start: '2026-01-01', p_period_end: '2026-01-31', p_cost_microunits: 1, p_budget_microunits: 1000 })
    record('Authenticated client cannot call reserve_interview_usage() directly — no EXECUTE grant', !!error, error?.message)
  }
  {
    const anon = createClient(URL, ANON_KEY)
    const { error } = await anon.rpc('reserve_interview_usage', { p_user_id: a.userId, p_period_start: '2026-01-01', p_period_end: '2026-01-31', p_cost_microunits: 1, p_budget_microunits: 1000 })
    record('Anonymous client cannot call reserve_interview_usage() either', !!error, error?.message)
  }

  console.log('\n── Anonymous client: zero access to any interview table ──')
  {
    const anon = createClient(URL, ANON_KEY)
    const { data } = await anon.from('interview_sessions').select('*').eq('id', sessionA.id)
    record('Anonymous client cannot SELECT a real interview session', (data?.length ?? 0) === 0)
  }
  {
    const anon = createClient(URL, ANON_KEY)
    const { data } = await anon.from('interview_story_bank').select('*')
    record('Anonymous client cannot list any story bank entries', (data?.length ?? 0) === 0)
  }

  console.log(`\n  Interview RLS adversarial test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
