'use client'
import { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function StickyMobileCTA() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div
      className={cn(
        'md:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300',
        visible ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="bg-surface-50/95 backdrop-blur-xl border-t border-border/60 px-4 py-3">
        <Link
          href="/signup"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-500))' }}
        >
          Start free
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="text-center text-xs text-muted-foreground mt-2">No credit card required</p>
      </div>
    </div>
  )
}
