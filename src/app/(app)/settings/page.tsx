'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { Profile } from '@/types/database'

const EXPERIENCE_LEVELS = [
  { value: 'student', label: 'Student' },
  { value: 'early', label: 'Early career (0-2 yrs)' },
  { value: 'mid', label: 'Mid-level (3-6 yrs)' },
  { value: 'senior', label: 'Senior (7+ yrs)' },
  { value: 'lead', label: 'Lead / Manager' },
]

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [industry, setIndustry] = useState('')
  const [expLevel, setExpLevel] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('profiles').select('*').single().then(({ data }) => {
      if (data) {
        setProfile(data)
        setName(data.full_name ?? '')
        setTargetRole(data.target_role ?? '')
        setIndustry(data.industry ?? '')
        setExpLevel(data.experience_level ?? '')
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
    }).eq('id', profile!.id)
    if (error) toast.error('Failed to save')
    else toast.success('Settings saved')
    setSaving(false)
  }

  async function deleteAccount() {
    const confirm = window.confirm('Are you sure you want to delete your account? This cannot be undone.')
    if (!confirm) return
    toast.error('Please contact support to delete your account.')
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
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and profile preferences.</p>
      </div>

      {/* Profile */}
      <div className="glass-card p-6 space-y-5">
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

      {/* Danger zone */}
      <div className="glass-card p-6 space-y-4 border-red-500/10">
        <h2 className="text-sm font-semibold text-red-400">Danger zone</h2>
        <Separator className="bg-red-500/10" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Delete account</p>
            <p className="text-xs text-muted-foreground">Permanently delete your account and all data. This cannot be undone.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={deleteAccount}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
