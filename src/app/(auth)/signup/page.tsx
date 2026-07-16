'use client'

import { useState, useEffect, useRef } from 'react'
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
import { trackMarketingEvent } from '@/lib/marketing/track-client'

const EASE = [0.21, 0.47, 0.32, 0.98] as const
const INVITE_TOKEN_PATTERN = /^[a-f0-9]{48}$/
type AdmissionState = 'open' | 'checking' | 'valid' | 'invalid'
type ReferralState = 'none' | 'checking' | 'valid' | 'invalid' | 'unavailable'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [admissionState, setAdmissionState] = useState<AdmissionState>('open')
  const [invitedEmailHint, setInvitedEmailHint] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referralState, setReferralState] = useState<ReferralState>('none')
  const [referralRemaining, setReferralRemaining] = useState(0)
  const signupStarted = useRef(false)

  function markSignupStarted(method: 'google' | 'email') {
    if (signupStarted.current) return
    signupStarted.current = true
    trackMarketingEvent('signup_started', { route: '/signup', cta_label: method })
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')?.trim().toLowerCase() ?? ''
    if (!invite) return
    if (!INVITE_TOKEN_PATTERN.test(invite)) {
      queueMicrotask(() => setAdmissionState('invalid'))
      return
    }

    queueMicrotask(() => {
      setInviteToken(invite)
      setAdmissionState('checking')
    })
    localStorage.setItem('showcase_invite', invite)

    const controller = new AbortController()
    void fetch(`/api/waitlist/admission?token=${encodeURIComponent(invite)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((result: { valid?: boolean; emailHint?: string }) => {
        setAdmissionState(result.valid ? 'valid' : 'invalid')
        setInvitedEmailHint(result.valid ? result.emailHint ?? null : null)
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setAdmissionState('invalid')
      })

    return () => controller.abort()
  }, [])

  // A completion referral is a real admission path, but only while the referrer has one of
  // their three database-enforced slots left. Invalid/exhausted links never enable signup.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // A waitlist invite and a member referral are two admission paths, not stackable
    // promotions. Prefer the explicit waitlist invite so one signup cannot consume both.
    if (params.has('invite')) {
      localStorage.removeItem('showcase_ref')
      return
    }
    const ref = params.get('ref')?.trim().toUpperCase() ?? ''
    if (!ref) return
    if (!/^[A-F0-9]{32}$/.test(ref)) {
      queueMicrotask(() => setReferralState('invalid'))
      return
    }

    queueMicrotask(() => {
      setReferralCode(ref)
      setReferralState('checking')
    })
    localStorage.setItem('showcase_ref', ref)
    const controller = new AbortController()
    void fetch(`/api/referral/validate?code=${encodeURIComponent(ref)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({})) as { valid?: boolean; remaining?: number }
        if (!response.ok) throw new Error(response.status === 429 || response.status === 503 ? 'temporarily-unavailable' : 'invalid')
        setReferralState(result.valid ? 'valid' : 'invalid')
        setReferralRemaining(result.valid ? Math.max(0, Number(result.remaining ?? 0)) : 0)
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setReferralState(error instanceof Error && error.message === 'invalid' ? 'invalid' : 'unavailable')
        }
      })
    return () => controller.abort()
  }, [])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    markSignupStarted('email')
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (inviteToken && admissionState !== 'valid') {
      toast.error('This invite link is not ready to use')
      return
    }
    if (referralCode && referralState !== 'valid') {
      toast.error(referralState === 'unavailable'
        ? 'Referral verification is temporarily unavailable. Please try again.'
        : 'This referral invite is no longer available')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const onboardingParams = new URLSearchParams()
    if (inviteToken) onboardingParams.set('invite', inviteToken)
    if (referralCode) onboardingParams.set('ref', referralCode)
    const nextPath = `/onboarding${onboardingParams.size ? `?${onboardingParams.toString()}` : ''}`
    const { data: signupData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(nextPath)}`,
      },
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (inviteToken && signupData.session) {
      let response: Response
      try {
        response = await fetch('/api/waitlist/admission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: inviteToken }),
        })
      } catch {
        router.push(nextPath)
        router.refresh()
        return
      }
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string }
        toast.error(result.error ?? 'Could not redeem this invite')
        setLoading(false)
        return
      }
      localStorage.removeItem('showcase_invite')
      await supabase.auth.refreshSession()
    }

    if (referralCode && signupData.session) {
      let response: Response
      try {
        response = await fetch('/api/referral/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: referralCode }),
        })
      } catch {
        router.push(nextPath)
        router.refresh()
        return
      }
      const result = await response.json().catch(() => ({})) as { data?: { claimed?: boolean }; error?: string }
      if (response.status === 429 || response.status === 503) {
        // The auth/profile trigger can very rarely still be settling. Preserve the code in
        // the URL + localStorage and let onboarding retry instead of burning a valid invite.
        router.push(nextPath)
        router.refresh()
        return
      }
      if (!response.ok || result.data?.claimed !== true) {
        toast.error(result.error ?? 'That referral invite was already claimed. Join the waitlist for access.')
        setLoading(false)
        return
      }
      localStorage.removeItem('showcase_ref')
      await supabase.auth.refreshSession()
    }

    if (!signupData.session) {
      toast.success('Check your email to finish creating your account')
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
            <p className="mb-3 text-sm text-muted-foreground lg:hidden">
              Build, edit, and privately preview your portfolio free. No credit card required.
            </p>
            <p className="text-muted-foreground text-sm">
              Already have one?{' '}
              <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors font-semibold">
                Sign in
              </Link>
            </p>
          </div>

          {admissionState === 'checking' && (
            <p className="mb-5 rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
              Checking your invite…
            </p>
          )}
          {admissionState === 'valid' && (
            <p className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
              Invite confirmed{invitedEmailHint ? ` for ${invitedEmailHint}` : ''}. Sign up with that email to claim access.
            </p>
          )}
          {admissionState === 'invalid' && (
            <p className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              This invite is invalid, expired, or already used. <Link href="/waitlist" className="underline underline-offset-2">Join the waitlist</Link> for a new one.
            </p>
          )}
          {referralState === 'checking' && (
            <p className="mb-5 rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
              Checking your member referral…
            </p>
          )}
          {referralState === 'valid' && (
            <p className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
              Member referral confirmed. It skips the waitlist and starts you with +5 AI credits. {referralRemaining} invite{referralRemaining === 1 ? '' : 's'} remain on this link.
            </p>
          )}
          {referralState === 'invalid' && (
            <p className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              This member referral is invalid or its three spots are already claimed. <Link href="/waitlist" className="underline underline-offset-2">Join the waitlist</Link> instead.
            </p>
          )}
          {referralState === 'unavailable' && (
            <p className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
              Referral verification is temporarily unavailable. Reload this page to try again; your invite has not been consumed.
            </p>
          )}

          <div className={admissionState === 'checking' || admissionState === 'invalid' || referralState === 'checking' || referralState === 'invalid' || referralState === 'unavailable' ? 'opacity-50' : undefined}>
            <GoogleButton
              next={(() => {
                const params = new URLSearchParams()
                if (inviteToken) params.set('invite', inviteToken)
                if (referralCode) params.set('ref', referralCode)
                return `/onboarding${params.size ? `?${params.toString()}` : ''}`
              })()}
              label="Sign up with Google"
              onStart={() => markSignupStarted('google')}
              disabled={admissionState === 'checking' || admissionState === 'invalid' || referralState === 'checking' || referralState === 'invalid' || referralState === 'unavailable'}
            />
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">or sign up with email</span>
            </div>
          </div>

          <form
            onSubmit={handleSignup}
            onFocusCapture={() => markSignupStarted('email')}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name" type="text" placeholder="Alex Chen" autoComplete="name"
                value={name} onChange={(e) => setName(e.target.value)} required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors max-md:p-3 max-md:-m-3"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && password.length < 8 && (
                <p className="text-xs text-red-400">At least 8 characters required</p>
              )}
            </div>
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full gap-2"
              loading={loading}
              disabled={admissionState === 'checking' || admissionState === 'invalid' || referralState === 'checking' || referralState === 'invalid' || referralState === 'unavailable'}
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 max-md:py-1.5 max-md:inline-block">Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 max-md:py-1.5 max-md:inline-block">Privacy Policy</Link>.
          </p>
        </motion.div>
      </div>
    </main>
  )
}
