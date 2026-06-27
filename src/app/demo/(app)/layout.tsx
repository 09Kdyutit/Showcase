import { Sidebar } from '@/components/dashboard/sidebar'
import type { Profile, Subscription } from '@/types/database'

const DEMO_PROFILE = {
  id: 'demo-user-id',
  email: 'alex.chen@example.com',
  full_name: 'Alex Chen',
  username: 'alex-chen',
  avatar_url: null,
  target_role: 'Senior Product Designer',
  experience_level: 'senior',
  industry: 'Technology',
  linkedin_url: 'https://linkedin.com/in/alex-chen',
  github_url: 'https://github.com/alex-chen',
  website_url: null,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
  onboarding_completed: true,
}

const DEMO_SUBSCRIPTION = {
  id: 'demo-sub-id',
  user_id: 'demo-user-id',
  stripe_customer_id: 'cus_demo',
  stripe_subscription_id: 'sub_demo',
  status: 'active' as const,
  plan: 'pro',
  current_period_start: '2026-06-17T00:00:00Z',
  current_period_end: '2026-07-17T00:00:00Z',
  cancel_at_period_end: false,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-06-17T10:00:00Z',
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar profile={DEMO_PROFILE as unknown as Profile} subscription={DEMO_SUBSCRIPTION as unknown as Subscription} />
      <main className="flex-1 overflow-y-auto thin-scrollbar pt-14 lg:pt-0">
        {/* Demo mode banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-xs text-amber-600 font-medium flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          Demo mode  -  static sample data for visual QA only
        </div>
        {children}
      </main>
    </div>
  )
}
