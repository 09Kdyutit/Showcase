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
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-surface-0/90 backdrop-blur-xl shadow-[0_1px_0_0_rgba(255,255,255,0.06)]'
          : 'bg-transparent'
      )}
    >
      {/* Top gradient line  -  appears on scroll */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-px transition-opacity duration-500',
          scrolled ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          background: 'linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--color-brand-500) 60%, transparent) 30%, color-mix(in oklch, var(--color-brand-400) 60%, transparent) 70%, transparent 100%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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
                'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                pathname === link.href
                  ? 'text-foreground bg-surface-200'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-200/60'
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
              <Button asChild variant="gradient" size="md" className="gap-1.5 shadow-[0_0_20px_rgba(99,70,200,0.25)] hover:shadow-[0_0_28px_rgba(99,70,200,0.4)] transition-shadow duration-300">
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
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-200 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/60 bg-surface-50/98 backdrop-blur-xl p-4 flex flex-col gap-1.5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-200 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2.5 mt-1 border-t border-border/60 flex flex-col gap-2">
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
