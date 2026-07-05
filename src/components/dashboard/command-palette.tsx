'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileText, Briefcase, BarChart3, Settings, CreditCard,
  Search, MessageSquare, Compass, Lightbulb, Mail, Zap, Command as CommandIcon,
  CornerDownLeft, ArrowRight,
} from 'lucide-react'

// ⌘K command palette — jump to any feature or action. Mounted once in the signed-in layout.
// Pure client, no data dependencies. Signals "serious product" and makes the whole app
// feel one keystroke away.

interface Cmd {
  id: string
  label: string
  hint?: string
  icon: React.ElementType
  href: string
  keywords: string
}

const COMMANDS: Cmd[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', keywords: 'home overview' },
  { id: 'resume', label: 'Resume & Cover Letters', icon: FileText, href: '/resume', keywords: 'cv builder cover letter' },
  { id: 'portfolio', label: 'Portfolio Builder', icon: Briefcase, href: '/builder', keywords: 'portfolio site publish' },
  { id: 'proofscore', label: 'ProofScore', icon: BarChart3, href: '/audit', keywords: 'audit score readiness' },
  { id: 'projects', label: 'Project Ideas', icon: Lightbulb, href: '/projects', keywords: 'projects build ideas' },
  { id: 'jobs', label: 'Jobs', icon: Search, href: '/jobs', keywords: 'jobs search pipeline apply tailor' },
  { id: 'opportunities', label: 'Opportunities', icon: Compass, href: '/opportunities', keywords: 'hackathons scholarships internships' },
  { id: 'interviews', label: 'Interview Lab', icon: MessageSquare, href: '/interviews', keywords: 'interview practice drills mock' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings', keywords: 'account profile email preferences referral' },
  { id: 'billing', label: 'Billing', icon: CreditCard, href: '/billing', keywords: 'billing plan pro upgrade subscription' },
  // Actions
  { id: 'new-interview', label: 'Start an interview', hint: 'Action', icon: Zap, href: '/interviews/new', keywords: 'practice new interview start' },
  { id: 'run-audit', label: 'Run a ProofScore', hint: 'Action', icon: BarChart3, href: '/audit', keywords: 'audit run score' },
  { id: 'cover-letter', label: 'Write a cover letter', hint: 'Action', icon: Mail, href: '/resume', keywords: 'cover letter write' },
  { id: 'upgrade', label: 'Upgrade to Pro', hint: 'Action', icon: Zap, href: '/billing', keywords: 'upgrade pro pay' },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  // Ref mirror of `open` so the keydown handler (registered once) reads the live value
  // without re-subscribing and without resetting state from an effect.
  const openRef = useRef(false)
  useEffect(() => { openRef.current = open }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (openRef.current) { setOpen(false) }
        else { setQuery(''); setActive(0); setOpen(true) }
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter((c) => (c.label + ' ' + c.keywords).toLowerCase().includes(q))
  }, [query])

  function go(cmd: Cmd | undefined) {
    if (!cmd) return
    setOpen(false)
    router.push(cmd.href)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.15s ease' }} />
      <div
        role="dialog"
        aria-label="Command palette"
        className="relative w-full max-w-xl rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-surface-100)',
          border: '1px solid color-mix(in oklch, var(--color-brand-500) 22%, var(--color-border))',
          boxShadow: '0 24px 70px oklch(0% 0 0 / 0.6), 0 0 0 1px oklch(0% 0 0 / 0.2)',
          animation: 'scaleIn 0.16s cubic-bezier(0.22,1,0.36,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); go(results[active]) }
            }}
            placeholder="Search features and actions…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground/60">ESC</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto thin-scrollbar py-2">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground/60">No matches</p>
          ) : (
            results.map((cmd, i) => {
              const Icon = cmd.icon
              const isActive = i === active
              return (
                <button
                  key={cmd.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(cmd)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  style={isActive ? { background: 'color-mix(in oklch, var(--color-brand-500) 12%, transparent)' } : undefined}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-brand-300' : 'text-muted-foreground/60'}`} />
                  <span className={`flex-1 text-sm ${isActive ? 'text-foreground' : 'text-foreground/80'}`}>{cmd.label}</span>
                  {cmd.hint && <span className="text-[10px] uppercase tracking-wide text-muted-foreground/40">{cmd.hint}</span>}
                  {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground/50" />}
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground/50">
          <span className="flex items-center gap-1.5"><CommandIcon className="h-3 w-3" /> K to toggle</span>
          <span className="flex items-center gap-1">navigate <ArrowRight className="h-3 w-3" /> enter to go</span>
        </div>
      </div>
    </div>
  )
}
