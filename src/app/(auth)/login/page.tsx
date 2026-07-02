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
    if (error) toast.error(error.message)
    else toast.success('Magic link sent — check your email')
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-background flex">
      <AuthAside variant="login" />

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
            <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-brand-400 hover:text-brand-300 transition-colors font-semibold">
                Create one free
              </Link>
            </p>
          </div>

          <GoogleButton next="/dashboard" label="Continue with Google" />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" placeholder="you@example.com" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={handleMagicLink} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  Send magic link instead
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                  autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="pr-10"
                />
                <button
                  type="button" onClick={() => setShowPw(!showPw)}
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
        </motion.div>
      </div>
    </main>
  )
}
