import Link from 'next/link'
import { ShieldCheck, FileText, Briefcase } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function NewUserState({ hasResume, hasPortfolio, displayName }: { hasResume: boolean; hasPortfolio: boolean; displayName: string }) {
  const firstName = displayName.split(' ')[0] || displayName
  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl border border-border/60 glass-card holo-border p-6 lg:p-10 text-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: 'radial-gradient(ellipse 70% 80% at 50% -10%, color-mix(in oklch, var(--color-brand-500) 14%, transparent), transparent)' }}
        />
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-15" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'oklch(63% 0.20 255)' }}>Interview Lab</p>
          <h1 className="text-display text-2xl lg:text-4xl font-semibold text-foreground text-balance">
            Practice until it&apos;s{' '}
            <em style={{ fontStyle: 'italic', color: 'oklch(70% 0.17 255)' }}>effortless,</em> {firstName}.
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
            One baseline session creates your first readiness estimate — grounded in your real experience, not generic questions. Most people start within two minutes.
          </p>
          <Button asChild variant="gradient" size="lg" className="mt-6 gap-2 btn-sheen" style={{ boxShadow: '0 0 22px color-mix(in oklch, var(--color-brand-500) 30%, transparent)' }}>
            <Link href="/interviews/new">Start your baseline interview</Link>
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Your evidence sources</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Résumé</span>
              <span className={hasResume ? 'text-emerald-400' : 'text-muted-foreground'}>{hasResume ? 'Connected' : 'Not added yet'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Portfolio</span>
              <span className={hasPortfolio ? 'text-emerald-400' : 'text-muted-foreground'}>{hasPortfolio ? 'Connected' : 'Not added yet'}</span>
            </div>
            {(!hasResume || !hasPortfolio) && (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border/60 mt-2">
                Optional - you can still practice without these, but connecting them lets Showcase ground your interview questions in your real experience.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> What to expect</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm text-muted-foreground">
            <p>You&apos;ll answer a handful of real interview questions, in text or live voice.</p>
            <p>Your transcript is private - visible only to you, never shared without your explicit consent.</p>
            <p>This is practice, not a real interview - Showcase never represents itself as an employer.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" /> Have a specific job in mind?</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">Practice based on a real job description from your Jobs list.</p>
          <Button asChild variant="outline" size="sm"><Link href="/jobs">Browse saved jobs</Link></Button>
        </CardContent>
      </Card>
    </div>
  )
}
