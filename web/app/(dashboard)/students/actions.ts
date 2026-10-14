'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function deleteStudent(studentId: string, departureReason: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (!['admin', 'deputy', 'manager'].includes(profile?.role ?? ''))
    return { error: 'Нет прав для удаления ученика' }

  await supabase.from('observations').delete().eq('student_id', studentId)

  const { error } = await supabase.from('students')
    .update({ status: 'departed', departure_reason: departureReason })
    .eq('id', studentId)
  if (error) return { error: 'Не удалось удалить ученика' }

  revalidatePath('/students')
  revalidatePath('/')
  revalidatePath('/analytics')
  return {}
}

export async function graduateClass(classId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (!['admin', 'manager'].includes(profile?.role ?? ''))
    return { error: 'Нет прав для выпуска класса' }

  const { data: activeStudents } = await supabase
    .from('students').select('id').eq('class_id', classId).eq('status', 'active')
  const activeIds = (activeStudents ?? []).map((s) => s.id)

  if (activeIds.length > 0) {
    await supabase.from('observations').delete().in('student_id', activeIds)
  }

  const { error: studentsErr } = await supabase
    .from('students')
    .update({ status: 'departed', departure_reason: 'Выпуск' })
    .eq('class_id', classId).eq('status', 'active')
  if (studentsErr) return { error: 'Не удалось перевести учеников' }

  const { error: classErr } = await supabase.from('classes').delete().eq('id', classId)
  if (classErr) return { error: 'Не удалось удалить класс' }

  revalidatePath('/students')
  revalidatePath('/')
  revalidatePath('/analytics')
  return {}
}

export async function updateClass(classId: string, grade: number, letter: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (!['admin', 'deputy', 'manager'].includes(profile?.role ?? ''))
    return { error: 'Нет прав для изменения класса' }

  const g = Math.trunc(grade)
  const l = (letter ?? '').trim()
  if (!g || !l) return { error: 'Укажите параллель и букву' }

  // Обновляем класс на месте — ученики ссылаются по class_id, их класс обновится сам
  const { error } = await supabase.from('classes')
    .update({ name: `${g}${l}`, grade: g, letter: l })
    .eq('id', classId)
  if (error) return { error: 'Не удалось изменить класс' }

  revalidatePath('/students')
  revalidatePath('/')
  revalidatePath('/analytics')
  return {}
}

export async function deleteClass(classId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (!['admin', 'manager'].includes(profile?.role ?? ''))
    return { error: 'Нет прав для удаления класса' }

  // Удаляем класс вместе с учениками и всеми их данными. Каскадов в БД нет, поэтому
  // чистим зависимые таблицы по порядку; admin-клиент — RLS не пускает удалять ai_insights.
  const db = createAdminClient()

  const { data: classStudents } = await db.from('students').select('id').eq('class_id', classId)
  const studentIds = (classStudents ?? []).map((s) => s.id)

  if (studentIds.length > 0) {
    const { data: obs } = await db.from('observations').select('id').in('student_id', studentIds)
    const obsIds = (obs ?? []).map((o) => o.id)
    if (obsIds.length > 0) {
      const { error } = await db.from('observation_reactions').delete().in('observation_id', obsIds)
      if (error) return { error: 'Не удалось удалить класс' }
    }
    for (const table of ['observations', 'ai_insight_versions', 'ai_insights', 'students']) {
      const { error } = await db.from(table).delete().in(table === 'students' ? 'id' : 'student_id', studentIds)
      if (error) return { error: 'Не удалось удалить класс' }
    }
  }

  // Сотрудники ссылаются на класс через users.class_id (внешний ключ без каскада)
  await db.from('users').update({ class_id: null }).eq('class_id', classId)

  const { error } = await db.from('classes').delete().eq('id', classId)
  if (error) return { error: 'Не удалось удалить класс' }

  revalidatePath('/students')
  revalidatePath('/')
  revalidatePath('/analytics')
  return {}
}
