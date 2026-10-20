import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { AddStaffForm } from '@/components/staff/AddStaffForm'

export default async function NewStaffPage() {
  await requireRole(['admin', 'manager'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users').select('school_id').eq('id', user!.id).single()

  const { data: classes } = await supabase
    .from('classes').select('id, name').eq('school_id', profile?.school_id ?? '').order('name')

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
        <Link href="/staff" className="hover:text-gray-600">Сотрудники</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-700 font-medium">Новый сотрудник</span>
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Добавить сотрудника</h1>
      <p className="text-sm text-gray-400 mb-6 sm:mb-8">Создайте аккаунт для нового сотрудника школы</p>

      <AddStaffForm classes={classes ?? []} />
    </div>
  )
}
