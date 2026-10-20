'use server'

import { createClient } from '@/lib/supabase/server'

export async function uploadSchoolLogo(formData: FormData): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, school_id')
    .eq('id', user.id)
    .single()

  if (!profile?.school_id) return { error: 'Школа не найдена' }
  if (!['admin', 'manager'].includes(profile.role ?? '')) return { error: 'Нет прав' }

  const file = formData.get('logo') as File
  if (!file || file.size === 0) return { error: 'Файл не выбран' }
  if (file.size > 2 * 1024 * 1024) return { error: 'Файл не должен превышать 2 МБ' }

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp']
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (!ALLOWED_TYPES.includes(file.type) || !ALLOWED_EXTS.includes(ext))
    return { error: 'Разрешены только изображения (JPG, PNG, WebP)' }

  const path = `schools/${profile.school_id}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { error: 'Ошибка загрузки файла' }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('schools')
    .update({ logo_url: publicUrl })
    .eq('id', profile.school_id)

  if (updateError) return { error: 'Ошибка сохранения' }

  return { url: publicUrl }
}
