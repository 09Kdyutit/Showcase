'use client'

import { motion } from 'framer-motion'
import { GraduationCap, Rocket, Briefcase, Repeat, ArrowRight } from 'lucide-react'

// "Built for" personas — each card carries its own accent hue, a gradient icon tile,
// a watermark index, and a concrete before→after transformation line, so the section
// reads as four distinct people instead of four identical boxes.

const PERSONAS = [
  {
    icon: GraduationCap,
    title: 'The Student',
    desc: 'Turning coursework and internships into credible, recruiter-ready case studies.',
    from: 'class projects',
    to: 'case studies',
    hue: 'oklch(63% 0.20 255)', // brand blue
  },
  {
    icon: Rocket,
    title: 'The New Grad',
    desc: 'Making side projects and first roles understandable to people who hire.',
    from: 'side projects',
    to: 'proof of skill',
    hue: 'oklch(62% 0.22 285)', // violet
  },
  {
    icon: Briefcase,
    title: 'The Early Pro',
    desc: 'Translating day-to-day work into measurable, defensible evidence.',
    from: 'daily work',
    to: 'measurable wins',
    hue: 'oklch(70% 0.14 200)', // cyan
  },
  {
    icon: Repeat,
    title: 'The Switcher',
    desc: 'Connecting previous experience to a brand-new target role.',
    from: 'old career',
    to: 'new target role',
    hue: 'oklch(68% 0.18 330)', // magenta
  },
] as const

export function PersonaCards() {
  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {PERSONAS.map(({ icon: Icon, title, desc, from, to, hue }, i) => (
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
          whileHover={{ y: -5 }}
          className="relative rounded-3xl p-7 overflow-hidden group"
          style={{
            background: `radial-gradient(130% 130% at 0% 0%, color-mix(in oklch, ${hue} 7%, var(--color-surface-100)), var(--color-surface-50) 60%)`,
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Accent top edge + hover border */}
          <div
            className="absolute top-0 left-0 right-0 h-px opacity-70"
            style={{ background: `linear-gradient(90deg, transparent, color-mix(in oklch, ${hue} 75%, transparent), transparent)` }}
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              border: `1px solid color-mix(in oklch, ${hue} 40%, transparent)`,
              background: `radial-gradient(80% 55% at 50% -10%, color-mix(in oklch, ${hue} 12%, transparent), transparent)`,
            }}
          />
          {/* Watermark index */}
          <span
            className="absolute top-5 right-6 text-display text-5xl font-semibold select-none transition-all duration-500 group-hover:-translate-y-1"
            style={{ color: `color-mix(in oklch, ${hue} 26%, transparent)`, fontStyle: 'italic' }}
          >
            0{i + 1}
          </span>

          <div className="relative">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-400 group-hover:scale-110 group-hover:-rotate-6"
              style={{
                background: `linear-gradient(135deg, color-mix(in oklch, ${hue} 28%, transparent), color-mix(in oklch, ${hue} 8%, transparent))`,
                border: `1px solid color-mix(in oklch, ${hue} 35%, transparent)`,
                boxShadow: `0 8px 24px color-mix(in oklch, ${hue} 18%, transparent), inset 0 1px 0 oklch(100% 0 0 / 0.1)`,
              }}
            >
              <Icon className="h-5 w-5" style={{ color: hue }} />
            </div>

            <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'oklch(64% 0.018 258)' }}>{desc}</p>

            {/* Transformation line */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: 'var(--color-surface-200)', border: '1px solid var(--color-border)', color: 'oklch(60% 0.02 258)' }}
              >
                {from}
              </span>
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-400 group-hover:translate-x-1"
                style={{ color: hue }}
              />
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: `color-mix(in oklch, ${hue} 13%, transparent)`,
                  border: `1px solid color-mix(in oklch, ${hue} 32%, transparent)`,
                  color: hue,
                }}
              >
                {to}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
