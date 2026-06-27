'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { tryCreateClient } from '@/lib/supabase/client'
import { Logo } from '@/components/shared/logo'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<unknown>(null)
  const pathname = usePathname()

  useEffect(() => {
    const supabase = tryCreateClient()
    if (supabase) supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const navLinks = [
    { href: '/#built-for', label: "Who it's for" },
    { href: '/#how-it-works', label: 'How it works' },
    { href: '/#faq', label: 'FAQ' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 pt-4">
      <div
        className={cn(
          'max-w-5xl mx-auto rounded-full border border-border bg-card/95 backdrop-blur-xl transition-shadow duration-300',
          scrolled ? 'shadow-[0_8px_24px_rgba(40,20,70,0.08)]' : 'shadow-[0_1px_2px_rgba(40,20,70,0.04)]'
        )}
      >
        <div className="px-4 sm:px-5 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Logo className="transition-transform duration-300 group-hover:scale-105" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                  pathname === link.href
                    ? 'text-foreground bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-2.5">
            {user ? (
              <Button asChild variant="gradient" size="md">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="md" className="text-muted-foreground hover:text-foreground">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild variant="gradient" size="md" className="gap-1.5">
                  <Link href="/signup">
                    <Zap className="h-3.5 w-3.5" />
                    Get started
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden max-w-5xl mx-auto mt-2 rounded-3xl border border-border bg-card/98 backdrop-blur-xl shadow-[0_8px_24px_rgba(40,20,70,0.08)] p-4 flex flex-col gap-1.5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2.5 mt-1 border-t border-border flex flex-col gap-2">
            {user ? (
              <Button asChild variant="gradient">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="secondary">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild variant="gradient" className="gap-1.5">
                  <Link href="/signup">
                    <Zap className="h-3.5 w-3.5" />
                    Get started
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
