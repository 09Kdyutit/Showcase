import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadHubData } from '@/lib/interviews/hub-data'
import { CommandHeader } from '@/components/interviews/hub/command-header'
import { ReadinessOverview } from '@/components/interviews/hub/readiness-overview'
import { NextActions } from '@/components/interviews/hub/next-actions'
import { EvidenceCoverage } from '@/components/interviews/hub/evidence-coverage'
import { RecentSessions } from '@/components/interviews/hub/recent-sessions'
import { PracticeResources } from '@/components/interviews/hub/practice-resources'
import { PrivacySummary } from '@/components/interviews/hub/privacy-summary'
import { UsageSummary } from '@/components/interviews/hub/usage-summary'
import { NewUserState } from '@/components/interviews/hub/new-user-state'
import { JobSpecificBanner } from '@/components/interviews/hub/job-specific-banner'

export default async function InterviewHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const displayName = profile?.full_name || user.email || 'there'

  const hub = await loadHubData(supabase, user.id, displayName)

  if (hub.isNewUser) {
    return (
      <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-6">
        <NewUserState hasResume={hub.hasResume} hasPortfolio={hub.hasPortfolio} displayName={displayName} />
        <UsageSummary usage={hub.usage} />
      </div>
    )
  }

  const headerTargetRole = hub.selectedJob?.targetRole ?? hub.primaryReadiness?.targetRole ?? hub.inProgressSession?.targetRole ?? null

  return (
    <main className="max-w-5xl mx-auto p-6 lg:p-10 space-y-6">
      <h1 className="sr-only">Interview Lab</h1>

      <CommandHeader
        displayName={displayName}
        targetRole={headerTargetRole}
        primaryReadiness={hub.primaryReadiness}
        topAction={hub.nextActions[0] ?? null}
      />

      {hub.selectedJob && <JobSpecificBanner job={hub.selectedJob} />}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ReadinessOverview groups={hub.readinessGroups} primary={hub.primaryReadiness} />
          <EvidenceCoverage coverage={hub.evidenceCoverage} />
          <RecentSessions sessions={hub.recentSessions} />
        </div>
        <div className="space-y-6">
          <UsageSummary usage={hub.usage} />
          <NextActions actions={hub.nextActions} />
          <PracticeResources drills={hub.recommendedDrills} />
          <PrivacySummary
            transcriptRetentionDays={hub.privacy.transcriptRetentionDays}
            rawAudioRetentionEnabled={hub.privacy.rawAudioRetentionEnabled}
            liveVoiceAvailable={hub.liveVoiceAvailable}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        Showcase never invents experience for your answers. Camera is optional and never used for appearance scoring.
      </p>
    </main>
  )
}
