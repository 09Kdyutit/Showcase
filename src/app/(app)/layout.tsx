import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileRes, subRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar profile={profileRes.data} subscription={subRes.data} />
      <main className="flex-1 overflow-y-auto thin-scrollbar pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
