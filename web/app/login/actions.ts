'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(_: unknown, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Неверный логин или пароль' }
  }

  // Только внутренние пути: «//evil.com» и «https://…» — это открытый редирект
  const next = (formData.get('next') as string | null) ?? ''
  const safe = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') && !next.startsWith('/login')
  redirect(safe ? next : '/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
