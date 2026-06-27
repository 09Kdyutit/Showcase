'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ArrowRight, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/shared/logo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleMagicLink() {
    if (!email) { toast.error('Enter your email first'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Magic link sent - check your email')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col flex-1 bg-surface-50 border-r border-border p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(40,20,70,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(40,20,70,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/6 rounded-full blur-3xl" />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 group w-fit">
            <Logo size="lg" />
          </Link>
        </div>

        {/* Center visual - ProofScore preview */}
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="relative z-10 glass-card p-6 w-72 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">ProofScore</p>
                <p className="text-4xl font-bold text-foreground">84</p>
                <p className="text-xs text-emerald-600 font-semibold mt-1">Strong</p>
              </div>
              <svg viewBox="0 0 80 80" className="w-16 h-16 -rotate-90">
                <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" className="text-surface-300" strokeWidth="8" />
                <circle cx="40" cy="40" r="30" fill="none" stroke="url(#login-ring)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 30 * 0.84} ${2 * Math.PI * 30 * 0.16}`} />
                <defs>
                  <linearGradient id="login-ring" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="space-y-2.5">
              {([
                ['First impression', 78, '#f59e0b'],
                ['Role alignment', 91, '#10b981'],
                ['Proof strength', 86, '#6366f1'],
                ['Resume quality', 72, '#f59e0b'],
              ] as const).map(([label, score, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
                  </div>
                  <span className="text-xs font-medium text-foreground w-6 text-right">{score}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/60 pt-1 border-t border-border/40">
              Your score is calculated across 11 hiring categories
            </p>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 space-y-4">
          <blockquote className="text-xl font-serif italic text-foreground leading-snug">
            &ldquo;Turn your experience into evidence.&rdquo;
          </blockquote>
          <div className="flex items-center gap-6 text-xs text-muted-foreground/50">
            <Link href="/terms" className="hover:text-muted-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-muted-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <Logo />
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">Sign in</h1>
            <p className="text-muted-foreground text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-brand-600 hover:text-brand-700 transition-colors font-medium">
                Create one free
              </Link>
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={handleMagicLink}
                  className="text-xs text-brand-600 hover:text-brand-700 transition-colors"
                >
                  Send magic link instead
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" variant="gradient" size="lg" className="w-full gap-2" loading={loading}>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">or continue with</span>
            </div>
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="w-full gap-2"
            onClick={handleMagicLink}
            loading={loading}
          >
            <Zap className="h-4 w-4 text-brand-600" />
            Send magic link
          </Button>
        </div>
      </div>
    </main>
  )
}
