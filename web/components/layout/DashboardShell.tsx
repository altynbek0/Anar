import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { MobileShell } from './MobileShell'
import { AssistantWidget } from '@/components/assistant/AssistantWidget'
import { getLocale } from '@/lib/i18n/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, locale] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, role, school_id, school:schools(name, logo_url)')
      .eq('id', user.id)
      .single(),
    getLocale(),
  ])

  const userName = profile?.full_name ?? user.email ?? ''
  const userRoleKey = profile?.role ?? ''
  const school = profile?.school as { name?: string; logo_url?: string | null } | null
  const schoolName = school?.name ?? 'Stride'
  const schoolLogoUrl = school?.logo_url ?? null
  const isAdmin = ['admin', 'manager'].includes(userRoleKey)

  return (
    <I18nProvider locale={locale}>
      <MobileShell
        sidebar={
          <Sidebar
            userName={userName}
            userRoleKey={userRoleKey}
            schoolName={schoolName}
            schoolLogoUrl={schoolLogoUrl}
            isAdmin={isAdmin}
          />
        }
      >
        {children}
      </MobileShell>
      {isAdmin && <AssistantWidget />}
    </I18nProvider>
  )
}
