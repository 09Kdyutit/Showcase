'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useTrackOnView } from '@/lib/marketing/track-client'
import type { MarketingEvent } from '@/lib/marketing/events'

/** Fires `event` once the section is ~50% visible. Exists so server-component pages
 *  (page.tsx) can opt a section into view-tracking without becoming client
 *  components themselves - only this wrapper needs the hook. */
export function TrackedSection({
  event,
  className,
  id,
  style,
  children,
}: {
  event: MarketingEvent
  className?: string
  id?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const ref = useTrackOnView<HTMLDivElement>(event)
  return (
    <div ref={ref} id={id} className={className} style={style}>
      {children}
    </div>
  )
}
