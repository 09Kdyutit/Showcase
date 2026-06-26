'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'

// Mode C  -  Role/industry marquee (safe static fallback)
// No company names, affiliations, or hiring claims
const CAREER_DOMAINS = [
  'Product Management',
  'Software Engineering',
  'UX & Product Design',
  'Data & Analytics',
  'Marketing & Growth',
  'Finance & Strategy',
  'Healthcare',
  'Consulting',
  'Operations',
  'Startups',
  'Machine Learning',
  'DevOps & Platform',
  'Sales & RevOps',
  'Research',
  'People & HR',
]

interface CompanyMarqueeProps {
  className?: string
}

export function CompanyMarquee({ className }: CompanyMarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  // Duplicate items for seamless loop
  const items = [...CAREER_DOMAINS, ...CAREER_DOMAINS]

  return (
    <div className={cn('w-full overflow-hidden select-none', className)}>
      {/* Label */}
      <p className="text-center text-xs text-muted-foreground/50 tracking-widest uppercase mb-6">
        Built for careers across
      </p>

      {/* Marquee container with edge fade */}
      <div className="relative">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div
          ref={trackRef}
          className="flex gap-4 marquee-track"
          aria-hidden="true"
        >
          {items.map((domain, i) => (
            <span
              key={i}
              className="flex-shrink-0 text-sm text-muted-foreground/60 font-medium border border-border bg-surface-100 rounded-full px-4 py-1.5 whitespace-nowrap"
            >
              {domain}
            </span>
          ))}
        </div>

        {/* Accessible non-duplicated version for screen readers */}
        <div className="sr-only" aria-label="Career domains Showcase supports">
          {CAREER_DOMAINS.join(', ')}
        </div>
      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none !important; }
        }
        .marquee-track {
          animation: marquee-scroll 40s linear infinite;
          width: max-content;
        }
        .marquee-track:hover,
        .marquee-track:focus-within {
          animation-play-state: paused;
        }
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
