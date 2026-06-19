'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile, Subscription } from '@/types/database'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const [profileRes, subRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
        ])
        setProfile(profileRes.data)
        setSubscription(subRes.data)
      }
      setLoading(false)
    }

    load()

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
        setSubscription(null)
      }
    })

    return () => authSub.unsubscribe()
  }, [])

  const isPro = subscription?.status === 'active' || subscription?.status === 'trialing'

  return { user, profile, subscription, loading, isPro }
}
