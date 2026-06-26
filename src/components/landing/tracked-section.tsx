'use client'

import type { ReactNode } from 'react'
import { useTrackOnView } from '@/lib/marketing/track-client'
import type { MarketingEvent } from '@/lib/marketing/events'

/** Fires `event` once the section is ~50% visible. Exists so server-component pages
 *  (page.tsx) can opt a section into view-tracking without becoming client
 *  components themselves  -  only this wrapper needs the hook. */
export function TrackedSection({
  event,
  className,
  id,
  children,
}: {
  event: MarketingEvent
  className?: string
  id?: string
  children: ReactNode
}) {
  const ref = useTrackOnView<HTMLDivElement>(event)
  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  )
}
