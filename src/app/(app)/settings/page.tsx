'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { PageShell, PageHeader } from '@/components/shared/page-header'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { apiErrorMessage } from '@/lib/utils'
import type { Profile } from '@/types/database'

const EXPERIENCE_LEVELS = [
  { value: 'student', label: 'Student' },
  { value: 'early', label: 'Early career (0-2 yrs)' },
  { value: 'mid', label: 'Mid-level (3-6 yrs)' },
  { value: 'senior', label: 'Senior (7+ yrs)' },
  { value: 'lead', label: 'Lead / Manager' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [industry, setIndustry] = useState('')
  const [expLevel, setExpLevel] = useState('')
  const [digestEnabled, setDigestEnabled] = useState(true)
  const [referral, setReferral] = useState<{ code: string; count: number; bonus: number } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('profiles').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        setProfile(data)
        setName(data.full_name ?? '')
        setTargetRole(data.target_role ?? '')
        setIndustry(data.industry ?? '')
        setExpLevel(data.experience_level ?? '')
        setDigestEnabled((data as { email_digest_enabled?: boolean }).email_digest_enabled ?? true)
        const d = data as { referral_code?: string; referral_count?: number; bonus_credits?: number }
        if (d.referral_code) setReferral({ code: d.referral_code, count: d.referral_count ?? 0, bonus: d.bonus_credits ?? 0 })
      }
      setLoading(false)
    })
  }, [])

  async function saveProfile() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      full_name: name,
      target_role: targetRole,
      industry,
      experience_level: expLevel,
      email_digest_enabled: digestEnabled,
    }).eq('id', profile!.id)
    if (error) toast.error('Failed to save')
    else toast.success('Settings saved')
    setSaving(false)
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: deleteConfirmText }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(apiErrorMessage(body?.error, 'Failed to delete account. Please try again.'))
        return
      }
      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success('Your account has been deleted.')
      router.push('/signup')
    } catch {
      toast.error('Failed to delete account. Please try again.')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDeleteConfirmText('')
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <PageShell>
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Your account, your"
        titleAccent="rules."
        description="Manage your account and profile preferences."
      />

      {/* Profile */}
      <div className="entrance entrance-delay-1 glass-card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">Profile</h2>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Chen" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile?.email ?? ''} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground/60">Email cannot be changed here.</p>
          </div>
        </div>
      </div>

      {/* Career profile */}
      <div className="glass-card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">Career profile</h2>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Target role</Label>
            <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Senior Product Designer" />
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Technology" />
          </div>
          <div className="space-y-2">
            <Label>Experience level</Label>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setExpLevel(l.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all duration-150 ${expLevel === l.value ? 'border-brand-500/50 bg-brand-500/10 text-brand-300' : 'border-border bg-surface-100 text-muted-foreground hover:text-foreground'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Button variant="gradient" size="sm" onClick={saveProfile} loading={saving}>
          Save changes
        </Button>
      </div>

      {/* Refer friends */}
      {referral && (
        <div className="glass-card p-6 space-y-4 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse 60% 80% at 100% 0%, color-mix(in oklch, var(--color-brand-500) 12%, transparent), transparent)' }} />
          <div className="relative">
            <h2 className="text-sm font-semibold text-foreground">Refer friends, earn credits</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Share your link. Each friend who signs up gives you <span className="text-brand-300 font-semibold">3 bonus AI credits</span> (extra ProofScores, résumé rewrites, and more).
            </p>
          </div>
          <div className="relative flex items-center gap-2">
            <div className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm font-mono truncate" style={{ background: 'var(--color-surface-200)', border: '1px solid var(--color-border)', color: 'oklch(80% 0.01 255)' }}>
              {(typeof window !== 'undefined' ? window.location.origin : '')}/signup?ref={referral.code}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${referral.code}`).catch(() => {})
                toast.success('Referral link copied')
              }}
            >
              Copy
            </Button>
          </div>
          <div className="relative flex items-center gap-6 text-sm">
            <div>
              <span className="text-2xl font-bold text-foreground stat-number">{referral.count}</span>
              <span className="text-xs text-muted-foreground ml-1.5">friend{referral.count === 1 ? '' : 's'} joined</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-brand-300 stat-number">{referral.bonus}</span>
              <span className="text-xs text-muted-foreground ml-1.5">bonus credits earned</span>
            </div>
          </div>
        </div>
      )}

      {/* Email preferences */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Email preferences</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-foreground">Weekly digest</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your ProofScore trend, jobs to follow up on, and interview readiness — once a week.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={digestEnabled}
            onClick={() => setDigestEnabled((v) => !v)}
            className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
            style={{ background: digestEnabled ? 'oklch(54% 0.230 255)' : 'var(--color-surface-300)' }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
              style={{ left: digestEnabled ? '22px' : '2px' }}
            />
          </button>
        </div>
        <Button variant="secondary" size="sm" onClick={saveProfile} loading={saving}>
          Save preferences
        </Button>
      </div>

      {/* Danger zone */}
      <div className="glass-card p-6 space-y-4 border-red-500/10">
        <h2 className="text-sm font-semibold text-red-400">Danger zone</h2>
        <Separator className="bg-red-500/10" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Delete account</p>
            <p className="text-xs text-muted-foreground">Permanently delete your account and all data. This cannot be undone.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmText('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account</DialogTitle>
            <DialogDescription>
              This permanently deletes your profile, resumes, portfolios, audits, saved jobs,
              applications, tailored assets, and subscription record. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Type DELETE to confirm</Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteConfirmText !== 'DELETE' || deleting}
              loading={deleting}
              onClick={deleteAccount}
            >
              Permanently delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
  )
}
