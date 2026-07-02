'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/shared/logo'
import { AuthAside } from '@/components/auth/auth-aside'
import { GoogleButton } from '@/components/auth/google-button'

const EASE = [0.21, 0.47, 0.32, 0.98] as const

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/callback?next=/onboarding`,
      },
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    router.push('/onboarding')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-background flex">
      <AuthAside variant="signup" />

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="w-full max-w-sm"
        >
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <Logo />
          </Link>

          <div className="mb-7">
            <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Create your account</h1>
            <p className="text-muted-foreground text-sm">
              Already have one?{' '}
              <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors font-semibold">
                Sign in
              </Link>
            </p>
          </div>

          <GoogleButton next="/onboarding" label="Sign up with Google" />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name" type="text" placeholder="Alex Chen" autoComplete="name"
                value={name} onChange={(e) => setName(e.target.value)} required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email" type="email" placeholder="you@example.com" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password" type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters"
                  autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="pr-10" required
                />
                <button
                  type="button" onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && password.length < 8 && (
                <p className="text-xs text-red-400">At least 8 characters required</p>
              )}
            </div>
            <Button type="submit" variant="gradient" size="lg" className="w-full gap-2" loading={loading}>
              Create account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">Privacy Policy</Link>.
          </p>
        </motion.div>
      </div>
    </main>
  )
}
