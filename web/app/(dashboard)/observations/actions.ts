'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function dismissAlert(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('role, class_id').eq('id', user.id).single()

  if (!['admin', 'deputy', 'manager', 'class_teacher'].includes(profile?.role ?? ''))
    return { error: 'Нет прав' }

  // Class teacher can only dismiss alerts for students in classes they lead
  if (profile?.role === 'class_teacher') {
    const { data: obs } = await supabase
      .from('observations').select('student_id').eq('id', id).single()
    if (!obs) return { error: 'Наблюдение не найдено' }

    const { data: student } = await supabase
      .from('students').select('class_id').eq('id', obs.student_id).single()
    if (!student?.class_id) return { error: 'Нет прав: ученик не в вашем классе' }

    const { data: cls } = await supabase
      .from('classes').select('id').eq('id', student.class_id).eq('teacher_id', user.id).maybeSingle()
    if (!cls) return { error: 'Нет прав: ученик не в вашем классе' }
  }

  const { error } = await supabase
    .from('observations')
    .update({ is_alert: false })
    .eq('id', id)

  if (error) return { error: 'Ошибка обновления' }

  revalidatePath('/', 'layout')
  return {}
}

export async function deleteObservation(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: obs } = await supabase
    .from('observations').select('author_id, created_at').eq('id', id).single()
  if (!obs) return { error: 'Наблюдение не найдено' }
  if (obs.author_id !== user.id) return { error: 'Нет прав' }

  // Убедиться, что это последнее наблюдение автора
  const { count } = await supabase
    .from('observations')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .gt('created_at', obs.created_at)

  if ((count ?? 0) > 0) return { error: 'Можно удалить только последнее наблюдение' }

  // Реакции других людей RLS удалить автору не даёт, а без каскада они блокируют удаление.
  // Автор и «последнее наблюдение» уже проверены выше — дальше чистим через service-role.
  const db = createAdminClient()
  await db.from('observation_reactions').delete().eq('observation_id', id)
  const { error } = await db.from('observations').delete().eq('id', id).eq('author_id', user.id)
  if (error) return { error: 'Ошибка удаления' }

  revalidatePath('/')
  return { success: true }
}
