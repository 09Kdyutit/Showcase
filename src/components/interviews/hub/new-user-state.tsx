import Link from 'next/link'
import { ShieldCheck, FileText, Briefcase } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function NewUserState({ hasResume, hasPortfolio, displayName }: { hasResume: boolean; hasPortfolio: boolean; displayName: string }) {
  const firstName = displayName.split(' ')[0] || displayName
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-6 lg:p-8 text-center">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Welcome to Interview Lab, {firstName}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Complete one baseline session to create your first readiness estimate. Most people start a real interview within two minutes.
        </p>
        <Button asChild size="lg" className="mt-5">
          <Link href="/interviews/new">Start your baseline interview</Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Your evidence sources</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Résumé</span>
              <span className={hasResume ? 'text-emerald-600' : 'text-muted-foreground'}>{hasResume ? 'Connected' : 'Not added yet'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Portfolio</span>
              <span className={hasPortfolio ? 'text-emerald-600' : 'text-muted-foreground'}>{hasPortfolio ? 'Connected' : 'Not added yet'}</span>
            </div>
            {(!hasResume || !hasPortfolio) && (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border/60 mt-2">
                Optional  -  you can still practice without these, but connecting them lets Showcase ground your interview questions in your real experience.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> What to expect</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm text-muted-foreground">
            <p>You&apos;ll answer a handful of real interview questions, in text or live voice.</p>
            <p>Your transcript is private  -  visible only to you, never shared without your explicit consent.</p>
            <p>This is practice, not a real interview  -  Showcase never represents itself as an employer.</p>
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
