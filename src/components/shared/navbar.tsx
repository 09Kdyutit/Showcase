'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { tryCreateClient } from '@/lib/supabase/client'

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
    { href: '/waitlist#how-it-works', label: 'How it works' },
    { href: '/waitlist#faq', label: 'FAQ' },
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
      {/* Top gradient line — appears on scroll */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-px transition-opacity duration-500',
          scrolled ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          background: 'linear-gradient(90deg, transparent 0%, oklch(54% 0.22 264 / 0.6) 30%, oklch(70% 0.18 295 / 0.6) 70%, transparent 100%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center transition-all duration-300 group-hover:scale-105">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            {/* Ambient glow */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 blur-md opacity-40 group-hover:opacity-75 transition-opacity duration-300" />
            {/* Hover border ring */}
            <div className="absolute -inset-0.5 rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: 'linear-gradient(135deg, oklch(63% 0.2 264), oklch(70% 0.18 295))',
                padding: '1px',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
            />
          </div>
          <span className="font-bold text-foreground tracking-tight">Showcase</span>
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
                <Link href="/waitlist">
                  <Zap className="h-3.5 w-3.5" />
                  Join Beta
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
                  <Link href="/waitlist">
                    <Zap className="h-3.5 w-3.5" />
                    Join Beta
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
