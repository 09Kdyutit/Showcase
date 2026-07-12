import Link from 'next/link'
import { Compass, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Themed 404 — replaces the default light-mode not-found page so a mistyped or dead link
// still lands on-brand. Public (no auth), so it points home rather than to the dashboard.
export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-6 overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[440px] aurora-mesh opacity-30" />
      <div className="relative text-center max-w-md">
        <p className="text-display text-[5rem] leading-none font-semibold mb-2" style={{ color: 'oklch(63% 0.20 255 / 0.4)', fontStyle: 'italic' }}>404</p>
        <h1 className="text-display text-2xl font-semibold text-foreground mb-2">This page doesn&apos;t exist.</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-7">
          The link may be broken or the page may have moved. Let&apos;s get you back on track.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild variant="gradient" size="md" className="gap-2 btn-sheen">
            <Link href="/">
              <Compass className="h-4 w-4" />
              Back to Showcase
            </Link>
          </Button>
          <Button asChild variant="ghost" size="md" className="gap-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              My dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
