import Link from 'next/link'
import { ArrowRight, Plus, CheckCircle2, FileText, BarChart3, TrendingUp, Zap, AlertCircle, Clock, Globe } from 'lucide-react'
import { ProofScoreRing } from '@/components/ui/proof-score-ring'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PORTFOLIOS = [
  {
    id: 'p1',
    title: 'Senior Product Designer',
    status: 'published',
    proof_score: 84,
    updated_at: '2026-06-15T10:00:00Z',
    target_role: 'Senior Product Designer · B2B SaaS',
  },
  {
    id: 'p2',
    title: 'UX Lead - Fintech',
    status: 'draft',
    proof_score: 72,
    updated_at: '2026-06-10T10:00:00Z',
    target_role: 'UX Lead · Fintech & Payments',
  },
]

const SETUP_STEPS = [
  { label: 'Resume uploaded', done: true, href: '/demo/resume' },
  { label: 'Portfolio built', done: true, href: '/demo/builder' },
  { label: 'ProofScore run', done: true, href: '/demo/audit' },
  { label: 'Portfolio published', done: true, href: '/demo/portfolio' },
]

const CATEGORIES = [
  { name: 'First Impression', score: 78, severity: 'major' },
  { name: 'Target Role Alignment', score: 91, severity: 'minor' },
  { name: 'Proof Strength', score: 41, severity: 'critical' },
  { name: 'Project Depth', score: 64, severity: 'major' },
  { name: 'Resume Quality', score: 76, severity: 'minor' },
  { name: 'Case Study Quality', score: 82, severity: 'minor' },
]

const ACTIVITY = [
  { label: 'Ran ProofScore audit - score improved from 71 → 84', time: '2 hours ago', icon: BarChart3 },
  { label: 'Added Checkout Redesign case study', time: 'Yesterday', icon: Plus },
  { label: 'Published portfolio', time: '2 days ago', icon: Globe },
]

const STATS = [
  { label: 'ProofScore', value: '84', color: 'text-emerald-600' },
  { label: 'Portfolios', value: '2', color: 'text-foreground' },
  { label: 'Role Fit', value: '91%', color: 'text-brand-600' },
  { label: 'Profile Complete', value: '87%', color: 'text-violet-600' },
]

export default function DemoDashboardPage() {
  const today = new Date('2026-06-17')
  const hour = 9
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}, Alex.</h1>
          <p className="text-muted-foreground text-sm mt-1">{dateStr} · Your portfolio is live and performing well.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/demo/builder">
              <Plus className="h-3.5 w-3.5" />
              New portfolio
            </Link>
          </Button>
          <Button asChild variant="gradient" size="sm" className="gap-1.5">
            <Link href="/demo/audit">
              <Zap className="h-3.5 w-3.5" />
              Run audit
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ProofScore hero */}
        <Card className="bg-surface-100 border-border lg:col-span-1">
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider self-start">Your ProofScore</p>
            <ProofScoreRing score={84} size="xl" animate={true} />
            <div className="w-full space-y-2 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Role Fit</span>
                <span className="text-emerald-600 font-semibold">91%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Confidence</span>
                <span className="text-emerald-600 font-semibold">High</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Gaps Found</span>
                <span className="text-amber-600 font-semibold">3</span>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full gap-1.5 mt-1">
              <Link href="/demo/audit">
                View full audit
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Next best action */}
        <Card className="bg-surface-100 border-amber-500/20 lg:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Next Best Action</p>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground mb-1">Strengthen Proof Strength</p>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Only 2 of 8 bullets have metrics. Adding 3 more could push your ProofScore from{' '}
                  <span className="text-amber-600 font-semibold">84 → 91</span>.
                  Recruiters skip unproven claims - numbers make you real.
                </p>
                <Button asChild variant="gradient" size="sm" className="gap-1.5">
                  <Link href="/demo/resume">
                    Fix it in Resume
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Mini score bars */}
            <div className="mt-6 space-y-2.5 border-t border-border/60 pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Score breakdown</p>
              {CATEGORIES.map((cat) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">{cat.name}</span>
                  <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${cat.score >= 80 ? 'bg-emerald-500' : cat.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${cat.score}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium w-6 text-right ${cat.score >= 80 ? 'text-emerald-600' : cat.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {cat.score}
                  </span>
                  {cat.severity === 'critical' && <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                  {cat.severity === 'minor' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600/60 shrink-0" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Setup checklist + Quick actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Checklist */}
        <Card className="bg-surface-100 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Setup complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {SETUP_STEPS.map((step) => (
              <Link key={step.label} href={step.href} className="flex items-center gap-3 group">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors truncate">{step.label}</span>
              </Link>
            ))}
            <div className="pt-2 border-t border-border/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">All steps complete</span>
                <span className="text-emerald-600 font-semibold">4 / 4</span>
              </div>
              <div className="mt-2 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div className="h-full w-full rounded-full bg-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="bg-surface-100 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
              <Link href="/demo/builder">
                <Plus className="h-3.5 w-3.5" />
                Add Project
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
              <Link href="/demo/audit">
                <BarChart3 className="h-3.5 w-3.5" />
                Run Audit
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
              <Link href="/demo/portfolio">
                <Globe className="h-3.5 w-3.5" />
                View Portfolio
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
              <Link href="/demo/resume">
                <FileText className="h-3.5 w-3.5" />
                Update Resume
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="bg-surface-100 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ACTIVITY.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-200 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground/80 leading-relaxed">{item.label}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground/50" />
                    <p className="text-[10px] text-muted-foreground/50">{item.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Portfolios */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Your portfolios</h2>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href="/demo/builder">View all →</Link>
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PORTFOLIOS.map((p) => (
            <Link key={p.id} href="/demo/builder" className="block group">
              <Card className="bg-surface-100 border-border hover:border-brand-500/20 transition-all duration-200 hover:shadow-glow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.target_role}</p>
                    </div>
                    <Badge variant={p.status === 'published' ? 'success' : 'default'} className="ml-2 shrink-0">
                      {p.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.proof_score >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${p.proof_score}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{p.proof_score}</span>
                  </div>
                  <p className="text-xs text-muted-foreground/50 mt-3">
                    Updated {new Date(p.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
