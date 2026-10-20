'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { randomInt } from 'node:crypto'

export async function deleteStaff(userId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('role, school_id').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Нет прав' }
  if (userId === user.id) return { error: 'Нельзя удалить самого себя' }

  // Verify target user belongs to same school
  const { data: target } = await supabase
    .from('users').select('school_id').eq('id', userId).single()
  if (!target || target.school_id !== profile.school_id)
    return { error: 'Пользователь не найден' }

  const admin = createAdminClient()

  // Внешние ключи без каскада: снимаем ссылки на сотрудника
  await admin.from('classes').update({ teacher_id: null }).eq('teacher_id', userId)
  await admin.from('observation_reactions').delete().eq('user_id', userId)

  // Есть наблюдения — удалить аккаунт нельзя (внешний ключ author_id). Вместо этого
  // деактивируем: вход заблокирован, из списка сотрудников скрыт, наблюдения и авторство остаются.
  const { count: obsCount } = await admin
    .from('observations').select('id', { count: 'exact', head: true }).eq('author_id', userId)
  if ((obsCount ?? 0) > 0) {
    const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
    if (banErr) return { error: 'Не удалось деактивировать сотрудника' }
    const { error: deactErr } = await admin
      .from('users').update({ is_active: false, class_id: null }).eq('id', userId)
    if (deactErr) {
      await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
      return { error: 'Не удалось деактивировать сотрудника' }
    }
    revalidatePath('/staff')
    revalidatePath('/', 'layout')
    return { success: true, deactivated: true, observations: obsCount ?? 0 }
  }

  const { error: delErr } = await admin.from('users').delete().eq('id', userId)
  if (delErr) return { error: 'Не удалось удалить сотрудника' }
  await admin.auth.admin.deleteUser(userId)

  revalidatePath('/staff')
  return { success: true }
}

export async function changeStaffRole(
  userId: string,
  newRole: string,
  classIds: string[] = [],
  newClass?: { grade: number; letter: string },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('role, school_id').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Нет прав' }
  if (userId === user.id) return { error: 'Нельзя изменить свою роль' }

  // Сотрудник и выбранные классы должны быть из школы администратора (дальше — service-role)
  const { data: target } = await supabase
    .from('users').select('school_id').eq('id', userId).single()
  if (!target || target.school_id !== profile.school_id) return { error: 'Пользователь не найден' }

  const admin = createAdminClient()
  if (classIds.length > 0) {
    const { data: own } = await admin
      .from('classes').select('id').eq('school_id', profile.school_id).in('id', classIds)
    if ((own ?? []).length !== new Set(classIds).size) return { error: 'Класс не найден' }
  }
  const resolved = [...classIds]

  // Create a new class if requested
  if (newRole === 'class_teacher' && newClass?.grade && newClass?.letter) {
    const { data: cls, error: clsErr } = await admin
      .from('classes')
      .insert({ school_id: profile.school_id, name: `${newClass.grade}${newClass.letter}`, grade: newClass.grade, letter: newClass.letter })
      .select('id').single()
    if (clsErr) return { error: 'Ошибка создания класса' }
    resolved.push(cls.id)
  }

  // Role + primary class (для совместимости users.class_id = первый класс)
  const { error } = await supabase.from('users').update({
    role: newRole,
    class_id: newRole === 'class_teacher' ? (resolved[0] ?? null) : null,
  }).eq('id', userId)
  if (error) return { error: 'Ошибка изменения роли' }

  // classes.teacher_id — источник правды о классах классрука.
  // Сначала снимаем все классы, которыми он руководил, затем ставим выбранные.
  await admin.from('classes').update({ teacher_id: null }).eq('teacher_id', userId)
  if (newRole === 'class_teacher' && resolved.length > 0) {
    await admin.from('classes').update({ teacher_id: userId }).in('id', resolved)
  }

  revalidatePath('/staff')
  revalidatePath('/', 'layout')
  return { success: true, classIds: resolved }
}

export async function resetStaffPassword(userId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('role, school_id').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Нет прав' }

  // Verify target user belongs to same school
  const { data: target } = await supabase
    .from('users').select('school_id').eq('id', userId).single()
  if (!target || target.school_id !== profile.school_id)
    return { error: 'Пользователь не найден' }

  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const newPassword = Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join('')

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) return { error: 'Ошибка сброса пароля' }

  return { success: true, password: newPassword }
}
