'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile, Subscription } from '@/types/database'

function normalizeClientError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return new Error(error.message)
  }
  return new Error(fallback)
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [authError, setAuthError] = useState<Error | null>(null)
  const [subscriptionError, setSubscriptionError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    const supabase = createClient()
    try {
      let authResult: Awaited<ReturnType<typeof supabase.auth.getUser>>
      try {
        authResult = await supabase.auth.getUser()
      } catch (error) {
        setAuthError(normalizeClientError(error, 'Could not verify the current user.'))
        setSubscriptionError(null)
        setUser(null)
        setProfile(null)
        setSubscription(null)
        return
      }

      if (authResult.error) {
        setAuthError(normalizeClientError(authResult.error, 'Could not verify the current user.'))
        setSubscriptionError(null)
        setUser(null)
        setProfile(null)
        setSubscription(null)
        return
      }

      const nextUser = authResult.data.user
      setAuthError(null)
      setUser(nextUser)
      if (!nextUser) {
        setProfile(null)
        setSubscription(null)
        setSubscriptionError(null)
        return
      }

      // maybeSingle, not single: a free user genuinely has zero subscription rows,
      // and .single() 406s on zero rows instead of returning null.
      try {
        const [profileRes, subRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', nextUser.id).maybeSingle(),
          supabase.from('subscriptions').select('*').eq('user_id', nextUser.id).maybeSingle(),
        ])
        setProfile(profileRes.data)
        if (subRes.error) {
          setSubscription(null)
          setSubscriptionError(normalizeClientError(
            subRes.error,
            'Could not verify the current subscription.'
          ))
        } else {
          setSubscription(subRes.data)
          setSubscriptionError(null)
        }
      } catch (error) {
        setProfile(null)
        setSubscription(null)
        setSubscriptionError(normalizeClientError(
          error,
          'Could not verify the current subscription.'
        ))
      }
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    load()

    // Refetch when the user returns to the tab (e.g. back from Stripe Checkout) or the
    // window regains focus, so Pro status — and every Upgrade/paywall gated on it —
    // updates automatically without a manual refresh.
    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onVisible)

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
        setSubscription(null)
        setAuthError(null)
        setSubscriptionError(null)
      } else {
        load()
      }
    })

    return () => {
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', onVisible)
      authSub.unsubscribe()
    }
  }, [load])

  const isPro = subscription?.status === 'active' || subscription?.status === 'trialing'

  return {
    user,
    profile,
    subscription,
    authError,
    subscriptionError,
    loading,
    isPro,
    refresh: load,
  }
}
