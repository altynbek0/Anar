import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Серверная проверка роли для страниц: меню скрывает пункты, но адрес можно открыть напрямую.
// Без входа — на /login, с неподходящей ролью — на главную.
export async function requireRole(roles: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (!profile || !roles.includes(profile.role)) redirect('/')
}
