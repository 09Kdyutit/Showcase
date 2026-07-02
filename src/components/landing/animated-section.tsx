'use client'
import { motion } from 'framer-motion'
import { useSyncExternalStore, type ReactNode } from 'react'

const EASE = [0.21, 0.47, 0.32, 0.98] as const

// Framer Motion's own useReducedMotion() reads window.matchMedia synchronously on
// the very first client render - on the server there is no window, so it has no
// choice but to assume false there. The result: a user with reduced motion enabled
// gets a server-rendered HTML that assumes animation is on, and a first client
// render that immediately disagrees, which is a real React hydration mismatch (seen
// directly in dev as a "1 Issue" hydration warning on every page).
//
// useSyncExternalStore is the React-documented pattern for exactly this case: a
// getServerSnapshot that's always `false` (matching what the server rendered) plus a
// subscription to the real browser media query for the client. No hydration
// mismatch, and it stays correctly subscribed if the OS-level setting changes.
const QUERY = '(prefers-reduced-motion: reduce)'
function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}
function getSnapshot() {
  return window.matchMedia(QUERY).matches
}
function getServerSnapshot() {
  return false
}
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduceMotion = usePrefersReducedMotion()
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 40, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-90px' }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.75, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerContainer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduceMotion = usePrefersReducedMotion()
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.09 } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerChild({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduceMotion = usePrefersReducedMotion()
  return (
    <motion.div
      variants={{
        hidden: reduceMotion ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 30, filter: 'blur(7px)' },
        visible: {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          transition: reduceMotion ? { duration: 0 } : { duration: 0.6, ease: EASE },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function FadeIn({
  children,
  className,
  delay = 0,
  from = 'bottom',
}: {
  children: ReactNode
  className?: string
  delay?: number
  from?: 'bottom' | 'left' | 'right' | 'none'
}) {
  const reduceMotion = usePrefersReducedMotion()
  const initial = reduceMotion
    ? { opacity: 1, x: 0, y: 0 }
    : from === 'left'
      ? { opacity: 0, x: -32 }
      : from === 'right'
        ? { opacity: 0, x: 32 }
        : from === 'none'
          ? { opacity: 0 }
          : { opacity: 0, y: 24 }

  return (
    <motion.div
      initial={initial}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.65, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
