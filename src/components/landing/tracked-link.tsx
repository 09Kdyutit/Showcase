'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { trackMarketingEvent } from '@/lib/marketing/track-client'
import type { MarketingEvent } from '@/lib/marketing/events'

/** A next/link that fires a marketing event on click before navigating. Exists so a
 *  server-component page can attach click tracking to a CTA without itself needing
 *  an inline closure passed across the server/client boundary. */
export function TrackedLink({
  event,
  ctaLabel,
  ...props
}: ComponentProps<typeof Link> & { event: MarketingEvent; ctaLabel: string }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        trackMarketingEvent(event, { cta_label: ctaLabel })
        props.onClick?.(e)
      }}
    />
  )
}
