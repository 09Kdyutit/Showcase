'use client'

import { useEffect } from 'react'

// Logs a public portfolio view to marketing_events (via the existing service-role track
// endpoint). Records only the slug + referrer host — both public, non-sensitive. Powers the
// owner's "portfolio views this week" analytics. Fires once per mount; deduping beyond that
// is intentionally light (a rough view count is the goal, not ad-grade attribution).
export function PortfolioViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    let sid = localStorage.getItem('sc_sid')
    if (!sid) {
      sid = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '')
      localStorage.setItem('sc_sid', sid)
    }
    let ref = 'direct'
    try {
      if (document.referrer) ref = new URL(document.referrer).hostname.replace(/^www\./, '')
    } catch { /* keep 'direct' */ }

    fetch('/api/marketing/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'portfolio_view',
        session_id: sid,
        path: `/p/${slug}`,
        metadata: { slug: slug.slice(0, 120), ref: ref.slice(0, 120) },
      }),
    }).catch(() => {})
  }, [slug])

  return null
}
