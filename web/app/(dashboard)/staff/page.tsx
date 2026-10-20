import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { ROLE_LABELS, ROLE_COLORS, cn } from '@/lib/utils'
import type { Role } from '@/types'
import { StaffTable } from '@/components/staff/StaffTable'

export default async function StaffPage() {
  await requireRole(['admin'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users').select('school_id, role').eq('id', user!.id).single()

  const staffQuery = (withActiveFilter: boolean) => {
    const q = supabase
      .from('users')
      .select('id, full_name, email, role, class_id')
      .eq('school_id', profile?.school_id ?? '')
    return (withActiveFilter ? q.neq('is_active', false) : q).order('full_name')
  }

  const [staffRes, { data: classes }] = await Promise.all([
    staffQuery(true),
    supabase
      .from('classes').select('id, name, grade, letter, teacher_id')
      .eq('school_id', profile?.school_id ?? '').order('name'),
  ])
  // Колонка is_active появляется SQL-миграцией; пока её нет — показываем всех
  const { data: staff } = staffRes.error ? await staffQuery(false) : staffRes

  // Count only manually-entered observations per author. Questionnaire-imported
  // observations are excluded so this matches the dashboard feed and stats, which
  // also filter source='manual' — and so the count drops when a teacher deletes one.
  const staffIds = (staff ?? []).map((s: any) => s.id)
  const obsCount = new Map<string, number>()
  if (staffIds.length > 0) {
    const { data: obsRows } = await supabase
      .from('observations')
      .select('author_id')
      .eq('source', 'manual')
      .in('author_id', staffIds)
    for (const r of (obsRows ?? []) as { author_id: string }[]) {
      obsCount.set(r.author_id, (obsCount.get(r.author_id) ?? 0) + 1)
    }
  }

  const ACCESS_MATRIX = [
    { label: 'Все наблюдения',        admin: true, deputy: true, teacher: false, class_teacher: false, psychologist: false, nurse: false, security: false, manager: false },
    { label: 'Аналитика школы',       admin: true, deputy: true, teacher: false, class_teacher: false, psychologist: false, nurse: false, security: false, manager: true },
    { label: 'Профиль ученика',       admin: true, deputy: true, teacher: true, class_teacher: true, psychologist: true, nurse: true, security: true, manager: true },
    { label: 'Добавить наблюдение',   admin: true, deputy: true, teacher: true, class_teacher: true, psychologist: true, nurse: true, security: true, manager: true },
    { label: 'Управление сотрудниками', admin: true, deputy: false, teacher: false, class_teacher: false, psychologist: false, nurse: false, security: false, manager: false },
  ]

  const ROLES: Role[] = ['admin', 'deputy', 'teacher', 'class_teacher', 'psychologist', 'nurse', 'security', 'manager']

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Сотрудники</h1>
          <p className="text-sm text-gray-400 mt-0.5">{staff?.length ?? 0} активных сотрудников</p>
        </div>
        <Link
          href="/staff/new"
          className="flex items-center gap-2 bg-[#2563EB] text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-[#1D4ED8] transition-colors whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          Добавить сотрудника
        </Link>
      </div>

      <div className="mb-6">
        <StaffTable
          staff={(staff ?? []).map((s: any) => {
            const myClasses = (classes ?? []).filter((c: any) => c.teacher_id === s.id)
            return {
              id: s.id,
              full_name: s.full_name,
              email: s.email,
              role: s.role,
              class_id: myClasses[0]?.id ?? s.class_id ?? null,
              class_ids: myClasses.map((c: any) => c.id),
              class_names: myClasses.map((c: any) => c.name),
              obs_count: obsCount.get(s.id) ?? 0,
            }
          })}
          classes={classes ?? []}
          currentUserId={user!.id}
        />
      </div>

      {/* Access matrix */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Матрица прав доступа</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 min-w-[200px]">Роль</th>
                {ROLES.map((r) => (
                  <th key={r} className="text-center text-xs font-medium text-gray-400 px-3 py-3 whitespace-nowrap">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCESS_MATRIX.map((row) => (
                <tr key={row.label} className="border-t border-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-700">{row.label}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-3 text-center">
                      <span className={cn('inline-block w-4 h-4 rounded-full', (row as Record<string, boolean | string>)[r] ? 'bg-green-400' : 'bg-gray-200')} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
