'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile, Subscription } from '@/types/database'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        // maybeSingle, not single: a free user genuinely has zero subscription rows,
        // and .single() 406s on zero rows instead of returning null.
        const [profileRes, subRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
        ])
        setProfile(profileRes.data)
        setSubscription(subRes.data)
      }
      setLoading(false)
    } finally {
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

  return { user, profile, subscription, loading, isPro, refresh: load }
}
