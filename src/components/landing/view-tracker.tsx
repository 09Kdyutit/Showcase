'use client'

import { useEffect } from 'react'
import { trackMarketingEvent } from '@/lib/marketing/track-client'
import type { MarketingEvent, MarketingEventMetadata } from '@/lib/marketing/events'

/** Fires `event` once on mount. Renders nothing - exists so a server-component page
 *  can record a page-view event without itself becoming a client component. */
export function ViewTracker({ event, metadata }: { event: MarketingEvent; metadata?: MarketingEventMetadata }) {
  useEffect(() => {
    trackMarketingEvent(event, metadata)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
