'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, FileText, Briefcase, BarChart3, Settings, CreditCard,
  LogOut, Zap, Menu, X, Search, MessageSquare, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { tryCreateClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Profile, Subscription } from '@/types/database'
import { Logo } from '@/components/shared/logo'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/resume', icon: FileText, label: 'Resume' },
  { href: '/builder', icon: Briefcase, label: 'Portfolio' },
  { href: '/audit', icon: BarChart3, label: 'ProofScore' },
  { href: '/jobs', icon: Search, label: 'Jobs' },
  { href: '/interviews', icon: MessageSquare, label: 'Interview Lab' },
]

const BOTTOM_ITEMS = [
  { href: '/settings', icon: Settings, label: 'Settings' },
  { href: '/billing', icon: CreditCard, label: 'Billing' },
]

interface SidebarProps {
  profile: Profile | null
  subscription: Subscription | null
}

export function Sidebar({ profile, subscription }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const isPro = subscription?.status === 'active' || subscription?.status === 'trialing'

  async function handleSignOut() {
    const supabase = tryCreateClient()
    if (supabase) await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/')
  }

  const initials = (profile?.full_name ?? profile?.email ?? '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const sidebarContent = (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Ambient top glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 opacity-50"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in oklch, oklch(54% 0.22 264) 18%, transparent), transparent)' }}
      />

      {/* Logo */}
      <div className="relative px-4 pt-5 pb-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={() => setMobileOpen(false)}>
          <Logo />
          {isPro && (
            <Badge
              variant="pro"
              className="ml-auto text-[10px] px-1.5 py-0.5"
              style={{ boxShadow: '0 0 10px color-mix(in oklch, oklch(54% 0.22 264) 40%, transparent)' }}
            >
              PRO
            </Badge>
          )}
        </Link>
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.06) 70%, transparent)' }}
        />
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto thin-scrollbar">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group overflow-hidden',
                active
                  ? 'nav-active text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 relative z-10 transition-colors',
                  active ? 'text-brand-300' : 'text-muted-foreground/60 group-hover:text-foreground/80'
                )}
              />
              <span className="relative z-10 tracking-wide">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Upgrade card */}
      {!isPro && (
        <div className="mx-2.5 mb-3">
          <div
            className="relative rounded-xl overflow-hidden p-4"
            style={{
              background: 'linear-gradient(135deg, color-mix(in oklch, oklch(39% 0.2 264) 28%, transparent), color-mix(in oklch, oklch(15% 0.014 264) 70%, transparent))',
              border: '1px solid color-mix(in oklch, oklch(54% 0.22 264) 22%, transparent)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in oklch, oklch(63% 0.2 264) 20%, transparent), transparent)' }}
            />
            <p className="relative text-xs font-semibold text-brand-200 mb-1 tracking-wide">Showcase Pro</p>
            <p className="relative text-xs text-muted-foreground leading-relaxed mb-3">
              Unlock full AI generation, job matching, Tailor Studio, and public portfolios.
            </p>
            <Button
              asChild
              variant="gradient"
              size="sm"
              className="relative w-full gap-1.5 text-xs"
              style={{ boxShadow: '0 0 20px color-mix(in oklch, oklch(54% 0.22 264) 35%, transparent)' }}
            >
              <Link href="/billing?plan=annual">
                <Zap className="h-3 w-3" />
                Save $30 - go annual
              </Link>
            </Button>
            <Link
              href="/billing?plan=monthly"
              className="relative block text-[11px] text-center text-muted-foreground/50 hover:text-muted-foreground mt-2 transition-colors"
            >
              or $15/mo billed monthly
            </Link>
          </div>
        </div>
      )}

      {/* Bottom section */}
      <div className="px-2.5 pb-3 relative">
        <div
          className="mb-3 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.06) 70%, transparent)' }}
        />

        <div className="space-y-0.5 mb-2">
          {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group overflow-hidden',
                  active
                    ? 'nav-active text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0 relative z-10', active ? 'text-brand-300' : 'text-muted-foreground/60 group-hover:text-foreground/80')} />
                <span className="relative z-10">{label}</span>
              </Link>
            )
          })}
        </div>

        {/* User card */}
        {profile && (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 hover:bg-white/[0.04] group"
            >
              <div className="relative shrink-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, oklch(54% 0.22 264), oklch(63% 0.18 295))',
                    boxShadow: '0 0 10px color-mix(in oklch, oklch(54% 0.22 264) 45%, transparent)',
                  }}
                >
                  {initials}
                </div>
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface-50"
                  style={{ background: 'oklch(65% 0.18 142)' }}
                />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-foreground/90 truncate">
                  {profile.full_name ?? profile.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-muted-foreground/50 truncate">{profile.email}</p>
              </div>
              <ChevronUp
                className={cn(
                  'h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-all duration-150',
                  userMenuOpen && 'rotate-180'
                )}
              />
            </button>

            {userMenuOpen && (
              <div
                className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden"
                style={{
                  background: 'oklch(11% 0.01 264)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 relative"
        style={{
          background: 'linear-gradient(180deg, oklch(9.5% 0.008 264) 0%, oklch(8.5% 0.006 264) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile header */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 backdrop-blur-xl border-b"
        style={{ background: 'rgba(12, 10, 18, 0.92)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo size="sm" />
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div
            className="relative w-64 h-full overflow-y-auto"
            style={{
              background: 'linear-gradient(180deg, oklch(9.5% 0.008 264) 0%, oklch(8.5% 0.006 264) 100%)',
              borderRight: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div className="pt-14">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
