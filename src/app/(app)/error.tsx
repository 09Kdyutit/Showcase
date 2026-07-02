'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCw, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Themed error boundary for the signed-in app. Without this, any runtime crash falls back
// to Next.js's default light-mode error page — jarring against the dark product. Keeps the
// user oriented (recover or go home) instead of stranded on a white screen.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log for diagnostics — message only, never private page data.
    console.error('[app-error-boundary]', error?.message, error?.digest ?? '')
  }, [error])

  return (
    <div className="relative min-h-full flex items-center justify-center p-6 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 aurora-mesh opacity-30" />
      <div className="relative text-center max-w-md">
        <div className="relative inline-flex mb-6">
          <span className="orbit-ring" aria-hidden="true" />
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: 'color-mix(in oklch, oklch(62% 0.20 25) 14%, var(--color-surface-100))',
              border: '1px solid color-mix(in oklch, oklch(62% 0.20 25) 30%, transparent)',
            }}
          >
            <AlertTriangle className="h-6 w-6" style={{ color: 'oklch(66% 0.19 25)' }} />
          </div>
        </div>
        <h1 className="text-display text-2xl font-semibold text-foreground mb-2">Something broke on our end.</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-7">
          This page hit an unexpected error. Your work is safe — nothing was published or changed.
          Try again, or head back to your dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} variant="gradient" size="md" className="gap-2 btn-sheen">
            <RotateCw className="h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="secondary" size="md" className="gap-2">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
