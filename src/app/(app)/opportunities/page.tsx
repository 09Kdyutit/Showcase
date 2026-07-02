'use client'

import { Globe } from 'lucide-react'
import { OpportunitiesView } from '@/components/opportunities/opportunities-view'

// Opportunities is now its own top-level section (was a tab inside Jobs). It surfaces
// hackathons, scholarships, internships, fellowships, grants, competitions and more,
// matched to the user — distinct enough from job listings to deserve its own home.
export default function OpportunitiesPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 lg:px-6 pt-5 pb-1 shrink-0">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
          <Globe className="h-5 w-5 text-brand-400" /> Opportunities
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hackathons, scholarships, internships, fellowships, grants, competitions and more — matched to you.
        </p>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        <OpportunitiesView region="" />
      </div>
    </div>
  )
}
