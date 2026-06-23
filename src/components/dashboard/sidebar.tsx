'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, FileText, Briefcase, BarChart3, Settings, CreditCard,
  LogOut, Zap, ChevronRight, Menu, X, Search, MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { tryCreateClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Profile, Subscription } from '@/types/database'

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
  const isPro = subscription?.status === 'active' || subscription?.status === 'trialing'

  async function handleSignOut() {
    const supabase = tryCreateClient()
    if (supabase) await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-border/60">
        <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={() => setMobileOpen(false)}>
          <div className="relative">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 blur-md opacity-30 group-hover:opacity-60 transition-opacity duration-200" />
          </div>
          <span className="font-bold text-foreground tracking-tight">Showcase</span>
          {isPro && <Badge variant="pro" className="ml-auto">Pro</Badge>}
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto thin-scrollbar">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 group',
                active
                  ? 'bg-brand-500/10 text-brand-300 border border-brand-500/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-200'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-400' : 'group-hover:text-foreground')} />
              {label}
              {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-brand-400/50" />}
            </Link>
          )
        })}
      </nav>

      {/* Upgrade card */}
      {!isPro && (
        <div className="mx-3 mb-3">
          <div className="rounded-xl bg-gradient-to-br from-brand-950/80 to-surface-300/60 border border-brand-500/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-xs font-semibold text-brand-300 mb-1">Showcase Pro</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">Unlock full AI generation, personalized job matching, Tailor Studio, and public portfolios.</p>
            <Button asChild variant="gradient" size="sm" className="w-full gap-1.5 text-xs shadow-[0_0_16px_rgba(99,70,200,0.3)]">
              <Link href="/billing?plan=annual">
                <Zap className="h-3 w-3" />
                Save $30 — go annual
              </Link>
            </Button>
            <Link href="/billing?plan=monthly" className="block text-[11px] text-center text-muted-foreground/60 hover:text-muted-foreground mt-2">
              or $15/mo billed monthly
            </Link>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div className="px-3 pb-4 border-t border-border pt-3 space-y-0.5">
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 group',
                active ? 'bg-surface-300 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-200'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
        {/* User + sign out */}
        {profile && (
          <div className="flex items-center gap-2 px-3 py-2 mt-1 rounded-xl hover:bg-surface-200 transition-colors group cursor-pointer" onClick={handleSignOut}>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-violet-600 flex items-center justify-center shrink-0 text-xs font-bold text-white">
              {(profile.full_name ?? profile.email)?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{profile.full_name ?? profile.email}</p>
              <p className="text-xs text-muted-foreground/60 truncate">{profile.email}</p>
            </div>
            <LogOut className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-surface-50 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 bg-surface-50/95 backdrop-blur-xl border-b border-border/60">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="font-bold text-foreground text-sm">Showcase</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-200 transition-colors"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-surface-50 border-r border-border h-full overflow-y-auto">
            <div className="pt-14">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
