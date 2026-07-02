'use client'

import { PageHeader } from '@/components/shared/page-header'
import { OpportunitiesView } from '@/components/opportunities/opportunities-view'

// Opportunities is now its own top-level section (was a tab inside Jobs). It surfaces
// hackathons, scholarships, internships, fellowships, grants, competitions and more,
// matched to the user — distinct enough from job listings to deserve its own home.
export default function OpportunitiesPage() {
  return (
    <div className="relative flex flex-col h-full">
      {/* Ambient kept as a fixed-height band so the scroll container below stays clean */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[320px] aurora-mesh opacity-40" />
      <div className="relative px-4 lg:px-6 pt-6 pb-2 shrink-0">
        <PageHeader
          eyebrow="Opportunities"
          title="Doors worth"
          titleAccent="opening."
          description="Hackathons, scholarships, internships, fellowships, grants, competitions and more — matched to you."
        />
      </div>
      <div className="relative flex-1 overflow-hidden flex flex-col">
        <OpportunitiesView region="" />
      </div>
    </div>
  )
}
