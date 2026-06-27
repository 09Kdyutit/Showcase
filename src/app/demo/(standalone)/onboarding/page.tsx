import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/shared/logo'

const EXPERIENCE_LEVELS = [
  { value: 'student', label: 'Student', desc: 'Currently in school or bootcamp' },
  { value: 'early', label: 'Early career', desc: '0-2 years of experience' },
  { value: 'mid', label: 'Mid-level', desc: '3-6 years of experience' },
  { value: 'senior', label: 'Senior', desc: '7+ years of experience', selected: true },
  { value: 'lead', label: 'Lead / Manager', desc: 'Leading teams or functions' },
]

const INDUSTRIES = [
  'Technology', 'Product', 'Design', 'Engineering', 'Marketing', 'Data / Analytics',
  'Finance', 'Healthcare', 'Education', 'Consulting', 'Startups', 'Other',
]

const STEPS = ['Role & Experience', 'Goals & Links', 'Resume']

export default function DemoOnboardingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Demo banner */}
        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-xs text-amber-600 font-medium flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          Demo mode - static sample data for visual QA only
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Set up your profile</h1>
          <p className="text-muted-foreground text-sm">This takes 2 minutes. We use this to personalize your portfolio and ProofScore.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-all duration-200 ${i === 0 ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40' : 'bg-surface-200 text-muted-foreground/40'}`}>
                {i + 1}
              </div>
              <span className={`text-xs font-medium transition-colors ${i === 0 ? 'text-foreground' : 'text-muted-foreground/50'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 ml-1 rounded-full bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1 - filled with demo data */}
        <div className="glass-card p-8 space-y-6">
          <div className="space-y-1.5">
            <Label>What role are you targeting?</Label>
            <Input
              readOnly
              defaultValue="Senior Product Designer"
              className="pointer-events-none"
            />
            <p className="text-xs text-muted-foreground/60">Be specific - this shapes your entire portfolio.</p>
          </div>

          <div className="space-y-2">
            <Label>Experience level</Label>
            <div className="grid gap-2">
              {EXPERIENCE_LEVELS.map((lvl) => (
                <div
                  key={lvl.value}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-left ${lvl.selected ? 'border-brand-500/50 bg-brand-500/5 text-foreground' : 'border-border bg-surface-100 text-muted-foreground'}`}
                >
                  <div>
                    <p className="text-sm font-medium">{lvl.label}</p>
                    <p className="text-xs opacity-70">{lvl.desc}</p>
                  </div>
                  {lvl.selected && <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Industry</Label>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((ind) => (
                <div
                  key={ind}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${ind === 'Technology' ? 'border-brand-500/50 bg-brand-500/10 text-brand-700' : 'border-border bg-surface-100 text-muted-foreground'}`}
                >
                  {ind}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex items-center justify-end mt-6">
          <Button variant="gradient" size="md" className="gap-2 pointer-events-none">
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
