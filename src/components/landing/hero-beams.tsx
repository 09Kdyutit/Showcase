'use client'

import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from './animated-section'

// Light beams tracing curved SVG paths — the 21st.dev / Aceternity "Background
// Beams" pattern, rebuilt for Showcase's blue→violet glow system. A faint static
// track is always painted; a bright gradient pulse travels each path on its own
// cadence. Purely decorative: parent must be position:relative, content above z-1.
//
// idPrefix must be unique per instance on a page — gradient <defs> ids are global
// to the document, so two instances sharing a prefix would cross-wire strokes.
export function HeroBeams({
  count = 12,
  idPrefix,
  className,
}: {
  count?: number
  idPrefix: string
  className?: string
}) {
  const reduceMotion = usePrefersReducedMotion()

  // Parallel S-curves swept across the viewBox diagonal. Deterministic (no
  // Math.random) so server and client render identical markup.
  const paths = Array.from({ length: count }, (_, i) => {
    const o = i * (720 / count)
    return `M${-300 + o} -80C${-300 + o} -80 ${-140 + o} 170 ${250 + o} 290C${640 + o} 410 ${810 + o} 640 ${810 + o} 640`
  })

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 960 540"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {paths.map((d, i) => (
          <path key={`track-${i}`} d={d} stroke="oklch(80% 0.09 255 / 0.07)" strokeWidth="1" />
        ))}
        {!reduceMotion &&
          paths.map((d, i) => (
            <path
              key={`beam-${i}`}
              d={d}
              stroke={`url(#${idPrefix}-beam-${i})`}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ))}
        <defs>
          {!reduceMotion &&
            paths.map((_, i) => (
              <motion.linearGradient
                key={`grad-${i}`}
                id={`${idPrefix}-beam-${i}`}
                gradientUnits="userSpaceOnUse"
                initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
                animate={{
                  x1: ['0%', '115%'],
                  x2: ['0%', '100%'],
                  y1: ['0%', '95%'],
                  y2: ['0%', '82%'],
                }}
                transition={{
                  duration: 8 + (i % 5) * 1.7,
                  delay: (i * 1.15) % 6,
                  repeat: Infinity,
                  repeatDelay: 1.6,
                  ease: 'linear',
                }}
              >
                <stop stopColor="#60a5fa" stopOpacity="0" />
                <stop offset="18%" stopColor="#60a5fa" />
                <stop offset="55%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </motion.linearGradient>
            ))}
        </defs>
      </svg>
    </div>
  )
}
