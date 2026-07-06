// Per-user activity report for the controlled release. Read-only. Run anytime:
//   node --env-file=.env.local scripts/user-activity.mjs
import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const grab = async (t, cols = '*') => (await a.from(t).select(cols)).data ?? []
const [profiles, resumes, portfolios, sessions, jobs, subs, events] = await Promise.all([
  grab('profiles', 'id, email, full_name, onboarding_completed, created_at'),
  grab('resumes', 'user_id, created_at'),
  grab('portfolios', 'user_id, status, ai_generated_at, slug, updated_at'),
  grab('interview_sessions', 'user_id, status, session_type, created_at'),
  grab('saved_jobs', 'user_id, status, created_at'),
  grab('subscriptions', 'user_id, status, current_period_end'),
  grab('marketing_events', 'user_id, event_name, created_at'),
])

const byUser = (rows) => { const m = new Map(); for (const r of rows) { if (!r.user_id) continue; (m.get(r.user_id) ?? m.set(r.user_id, []).get(r.user_id)).push(r) } return m }
const R = byUser(resumes), P = byUser(portfolios), S = byUser(sessions), J = byUser(jobs), E = byUser(events)
const subFor = new Map(subs.map((s) => [s.user_id, s]))
const isPro = (s) => s && (s.status === 'active' || s.status === 'trialing') && (!s.current_period_end || new Date(s.current_period_end) > new Date())

const fmt = (d) => d ? new Date(d).toLocaleString('en-SG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const ago = (d) => { if (!d) return '—'; const h = (Date.now() - new Date(d)) / 3.6e6; return h < 1 ? `${Math.round(h*60)}m ago` : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h/24)}d ago` }

profiles.sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
console.log(`\n════════ ${profiles.length} users ════════\n`)
for (const p of profiles) {
  const ports = P.get(p.id) ?? [], sess = S.get(p.id) ?? [], sj = J.get(p.id) ?? [], ev = E.get(p.id) ?? []
  const pub = ports.filter((x) => x.status === 'published').length
  const aiGen = ports.filter((x) => x.ai_generated_at).length
  const applied = sj.filter((x) => x.status === 'applied').length
  const lastEv = ev.map((x) => x.created_at).sort().at(-1)
  const lastActivity = [lastEv, ...ports.map(x=>x.updated_at), ...sess.map(x=>x.created_at)].filter(Boolean).sort().at(-1)

  console.log(`● ${p.email}${p.full_name ? `  (${p.full_name})` : ''}   ${isPro(subFor.get(p.id)) ? '💳 PRO' : 'free'}`)
  console.log(`   joined ${fmt(p.created_at)} · onboarding ${p.onboarding_completed ? '✓' : '✗'} · last active ${ago(lastActivity)}`)
  console.log(`   résumé ${(R.get(p.id)?.length ?? 0) > 0 ? '✓' : '✗'}  ·  portfolios ${ports.length} (${pub} published, ${aiGen} AI-built)  ·  interviews ${sess.length}  ·  jobs ${sj.length} saved / ${applied} applied`)
  // recent activity trail (last 6 meaningful events)
  const trail = ev.slice().sort((x,y)=> new Date(y.created_at)-new Date(x.created_at)).slice(0, 6)
  if (trail.length) console.log('   recent: ' + trail.map((x) => `${x.event_name} (${ago(x.created_at)})`).join('  →  '))
  console.log()
}
