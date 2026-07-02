'use client'

import { motion, useReducedMotion } from 'framer-motion'

// Remounts on every route change inside the signed-in app, so each navigation gets a
// cinematic blur-to-sharp entrance — the same reveal language as the landing headline.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  )
}
