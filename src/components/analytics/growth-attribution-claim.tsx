'use client'

import { useEffect } from 'react'
import { getMarketingSessionId } from '@/lib/marketing/track-client'

/** Claims the existing anonymous first-touch session after an authenticated app visit. */
export function GrowthAttributionClaim({ userId }: { userId: string }) {
  useEffect(() => {
    const sessionId = getMarketingSessionId()
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(sessionId)) return
    const storageKey = `showcase_attribution_claimed_${userId}_${sessionId}`
    try {
      if (window.sessionStorage.getItem(storageKey)) return
      window.sessionStorage.setItem(storageKey, '1')
    } catch {
      // The server endpoint is idempotent, so a storage-disabled browser may retry safely.
    }

    fetch('/api/growth/attribution/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
      keepalive: true,
    }).catch(() => {})
  }, [userId])

  return null
}
