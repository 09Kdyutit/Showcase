'use client'

import { useEffect, useRef } from 'react'
import type { MarketingEvent, MarketingEventMetadata } from './events'

const SESSION_KEY = 'showcase_session_id'

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  try {
    let id = window.localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

function readUtm() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source') ?? undefined,
    utm_medium: params.get('utm_medium') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
  }
}

/** Fire-and-forget. Never throws, never blocks rendering, never awaited by callers. */
export function trackMarketingEvent(event: MarketingEvent, metadata: MarketingEventMetadata = {}) {
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify({
      event_name: event,
      session_id: getSessionId(),
      path: window.location.pathname,
      metadata,
      ...readUtm(),
    })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/marketing/track', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/marketing/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    }
  } catch {
    // Analytics must never crash the page.
  }
}

/** Fires `event` once, the first time `ref`'s element becomes >=50% visible. */
export function useTrackOnView<T extends HTMLElement>(event: MarketingEvent, metadata: MarketingEventMetadata = {}) {
  const ref = useRef<T | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || fired.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true
            trackMarketingEvent(event, metadata)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])

  return ref
}
