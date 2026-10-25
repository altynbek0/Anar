'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

type Db = ReturnType<typeof createAdminClient>

// Колонка departed_at появляется миграцией 20261020000000: пока её нет, обновляем без неё,
// чтобы удаление/выпуск не ломались между выкладкой кода и применением SQL.
async function markDeparted(
  db: Db,
  apply: (extra: Record<string, unknown>) => PromiseLike<{ error: { message?: string } | null }>,
) {
  const res = await apply({ departed_at: new Date().toISOString() })
  if (res.error?.message?.includes('departed_at')) return apply({})
  return res
}

// Полное удаление учеников и всех их данных. Каскадов в БД нет, поэтому чистим зависимые
// таблицы по порядку; вызывать только с service-role клиентом после проверки прав и школы.
async function purgeStudents(db: Db, studentIds: string[]): Promise<string | null> {
  if (studentIds.length === 0) return null
  const { data: obs } = await db.from('observations').select('id').in('student_id', studentIds)
  const obsIds = (obs ?? []).map((o) => o.id)
  if (obsIds.length > 0) {
    const { error } = await db.from('observation_reactions').delete().in('observation_id', obsIds)
    if (error) return error.message
  }
  for (const table of ['observations', 'ai_insight_versions', 'ai_insights', 'students']) {
    const { error } = await db.from(table).delete().in(table === 'students' ? 'id' : 'student_id', studentIds)
    if (error) return error.message
  }
  return null
}

export async function deleteStudent(studentId: string, departureReason: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('role, school_id').eq('id', user.id).single()

  if (!['admin', 'deputy', 'manager'].includes(profile?.role ?? ''))
    return { error: 'Нет прав для удаления ученика' }

  // Ученик должен быть из школы вызывающего (RLS на students_select это гарантирует)
  const { data: student } = await supabase
    .from('students').select('id').eq('id', studentId).eq('school_id', profile!.school_id).maybeSingle()
  if (!student) return { error: 'Ученик не найден' }

  // Наблюдения чужих авторов RLS удалить не даёт — чистим через service-role
  const db = createAdminClient()
  const { data: obs } = await db.from('observations').select('id').eq('student_id', studentId)
  const obsIds = (obs ?? []).map((o) => o.id)
  if (obsIds.length > 0) {
    const { error: rErr } = await db.from('observation_reactions').delete().in('observation_id', obsIds)
    if (rErr) return { error: 'Не удалось удалить ученика' }
    const { error: oErr } = await db.from('observations').delete().in('id', obsIds)
    if (oErr) return { error: 'Не удалось удалить ученика' }
  }

  const { error } = await markDeparted(db, (extra) => db.from('students')
    .update({ status: 'departed', departure_reason: departureReason, ...extra })
    .eq('id', studentId))
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
    .from('users').select('role, school_id').eq('id', user.id).single()

  if (!['admin', 'manager'].includes(profile?.role ?? ''))
    return { error: 'Нет прав для выпуска класса' }

  const db = createAdminClient()

  const { data: cls } = await db
    .from('classes').select('id').eq('id', classId).eq('school_id', profile!.school_id).maybeSingle()
  if (!cls) return { error: 'Класс не найден' }

  const { data: activeStudents } = await db
    .from('students').select('id').eq('class_id', classId).eq('status', 'active')
  const activeIds = (activeStudents ?? []).map((s) => s.id)

  if (activeIds.length > 0) {
    const { data: obs } = await db.from('observations').select('id').in('student_id', activeIds)
    const obsIds = (obs ?? []).map((o) => o.id)
    if (obsIds.length > 0) {
      const { error: rErr } = await db.from('observation_reactions').delete().in('observation_id', obsIds)
      if (rErr) return { error: 'Не удалось перевести учеников' }
      const { error: oErr } = await db.from('observations').delete().in('id', obsIds)
      if (oErr) return { error: 'Не удалось перевести учеников' }
    }
  }

  // class_id обнуляем: иначе внешний ключ students.class_id не даст удалить класс
  const { error: studentsErr } = await markDeparted(db, (extra) => db
    .from('students')
    .update({ status: 'departed', departure_reason: 'Выпуск', class_id: null, ...extra })
    .eq('class_id', classId).eq('status', 'active'))
  if (studentsErr) return { error: 'Не удалось перевести учеников' }

  // Выбывшие ученики этого класса (ранее ушедшие) тоже держат ссылку на класс
  await db.from('students').update({ class_id: null }).eq('class_id', classId)
  await db.from('users').update({ class_id: null }).eq('class_id', classId)

  const { error: classErr } = await db.from('classes').delete().eq('id', classId)
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
    .from('users').select('role, school_id').eq('id', user.id).single()

  if (!['admin', 'manager'].includes(profile?.role ?? ''))
    return { error: 'Нет прав для удаления класса' }

  // Удаляем класс вместе с учениками и всеми их данными. Каскадов в БД нет, поэтому
  // чистим зависимые таблицы по порядку; admin-клиент — RLS не пускает удалять ai_insights.
  const db = createAdminClient()

  // service-role обходит RLS — убеждаемся, что класс принадлежит школе вызывающего
  const { data: cls } = await db
    .from('classes').select('id').eq('id', classId).eq('school_id', profile!.school_id).maybeSingle()
  if (!cls) return { error: 'Класс не найден' }

  const { data: classStudents } = await db.from('students').select('id').eq('class_id', classId)
  const studentIds = (classStudents ?? []).map((s) => s.id)

  const purgeErr = await purgeStudents(db, studentIds)
  if (purgeErr) return { error: 'Не удалось удалить класс' }

  // Сотрудники ссылаются на класс через users.class_id (внешний ключ без каскада)
  await db.from('users').update({ class_id: null }).eq('class_id', classId)

  const { error } = await db.from('classes').delete().eq('id', classId)
  if (error) return { error: 'Не удалось удалить класс' }

  revalidatePath('/students')
  revalidatePath('/')
  revalidatePath('/analytics')
  return {}
}

// Удаляет всех активных учеников без класса одним действием (группа «Без класса» в списке).
// Выпускников (выбывшие без класса) не трогаем — это архив.
export async function deleteClasslessStudents(): Promise<{ error?: string; deleted?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('role, school_id').eq('id', user.id).single()
  if (!['admin', 'deputy', 'manager'].includes(profile?.role ?? ''))
    return { error: 'Нет прав для удаления учеников' }

  const db = createAdminClient()
  const { data: students } = await db
    .from('students').select('id')
    .eq('school_id', profile!.school_id).eq('status', 'active').is('class_id', null)
  const ids = (students ?? []).map((s) => s.id)
  if (ids.length === 0) return { deleted: 0 }

  if (await purgeStudents(db, ids)) return { error: 'Не удалось удалить учеников' }

  revalidatePath('/students')
  revalidatePath('/')
  revalidatePath('/analytics')
  return { deleted: ids.length }
}
