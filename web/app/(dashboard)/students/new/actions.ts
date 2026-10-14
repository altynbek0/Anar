'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { generateInitialSummaries, NO_DATA } from '@/lib/ai/student-summaries'

// Название класса — параллель и буква («5А», «10Б», «11»). Любой другой текст в колонке
// «Класс» (ответы анкеты, съехавшие колонки) классом не считаем, иначе в списке
// появляются «классы» вроде «доброжелательная».
function isClassName(name: string | undefined): name is string {
  return !!name && /^\d{1,2}\s?[A-Za-zА-Яа-яЁё]{0,3}$/.test(name)
}

export async function addStudent(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('school_id').eq('id', user.id).single()
  if (!profile?.school_id) return { error: 'Школа не найдена' }

  const full_name = (formData.get('full_name') as string).trim()
  let class_id = formData.get('class_id') as string || null
  const new_class_grade = parseInt(formData.get('new_class_grade') as string)
  const new_class_letter = (formData.get('new_class_letter') as string | null)?.trim()
  const parent_name = (formData.get('parent_name') as string).trim() || null
  const parent_phone = (formData.get('parent_phone') as string).trim() || null
  const goals_raw = (formData.get('goals') as string).trim()
  const goals = goals_raw ? goals_raw.split('\n').map(g => g.trim()).filter(Boolean) : []

  if (!full_name) return { error: 'Введите ФИО ученика' }

  // Create new class if requested
  if (class_id === '__new__') {
    if (!new_class_grade || !new_class_letter) return { error: 'Укажите параллель и букву класса' }
    const name = `${new_class_grade}${new_class_letter}`
    const { data: cls, error: clsErr } = await supabase
      .from('classes')
      .insert({ school_id: profile.school_id, name, grade: new_class_grade, letter: new_class_letter })
      .select('id').single()
    if (clsErr) return { error: 'Нет прав для создания класса. Войдите как администрация или завуч.' }
    class_id = cls.id
  }

  const { data, error } = await supabase.from('students').insert({
    school_id: profile.school_id,
    class_id,
    full_name,
    parent_name,
    parent_phone,
    goals,
    status: 'active',
    risk_level: 'none',
  }).select('id').single()

  if (error) return { error: 'Ошибка при создании ученика' }

  redirect(`/students/${data.id}`)
}

interface ImportRow {
  full_name: string
  class_name?: string
  parent_name?: string
  parent_phone?: string
}

interface QuestionnaireRow {
  full_name: string
  class_name: string
  class_type: string
  parent_name: string
  parent_phone: string
  family_situation: string
  health_status: string
  parent_goal: string
  enrollment_year: string
  dream: string
  goals: string[]
  teacher_notes: string
}

export async function importFromQuestionnaires(rows: QuestionnaireRow[]): Promise<{ imported: number; skipped?: number; observations?: number; error?: string }> {
  // Auth check via cookie client
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { imported: 0, error: 'Не авторизован' }

  const { data: profile } = await authClient
    .from('users').select('school_id').eq('id', user.id).single()
  if (!profile?.school_id) return { imported: 0, error: 'Школа не найдена' }

  // Use admin client for all DB writes — bypasses RLS for server-side bulk operations
  const db = createAdminClient()
  const schoolId = profile.school_id

  const classNames = [...new Set(rows.map(r => r.class_name?.trim()).filter(isClassName))] as string[]
  const classTypeMap: Record<string, string> = {}
  for (const r of rows) {
    if (r.class_name?.trim() && r.class_type?.trim()) classTypeMap[r.class_name.trim()] = r.class_type.trim()
  }
  const classMap: Record<string, string> = {}

  if (classNames.length > 0) {
    const { data: existing } = await db
      .from('classes').select('id, name').eq('school_id', schoolId).in('name', classNames)
    for (const c of existing ?? []) classMap[c.name] = c.id

    for (const name of classNames) {
      if (classMap[name]) continue
      // Ведущие цифры = параллель, остаток = буква (может быть пустым для «10» без секции).
      // ВАЖНО: (.+) жадно откусывал последнюю цифру у «10» → grade=1, letter=«0». Используем (.*).
      const match = name.match(/^(\d+)(.*)$/)
      const grade = match ? parseInt(match[1]) : 0
      const letter = match ? match[2].trim() : name
      const type = classTypeMap[name] || null
      const { data: cls } = await db
        .from('classes').insert({ school_id: schoolId, name, grade, letter, type }).select('id').single()
      if (cls) classMap[name] = cls.id
    }
  }

  const validRows = rows.filter(r => r.full_name?.trim())
  if (validRows.length === 0) return { imported: 0, error: 'Нет данных для импорта' }

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

  // Build observation content for AI analysis — behavioral and motivational data only
  function buildObsContent(r: QuestionnaireRow): string {
    const parts: string[] = []
    if (r.teacher_notes?.trim())    parts.push(r.teacher_notes.trim())
    if ((r.goals ?? []).length > 0) parts.push(`Цель ученика: ${r.goals.join('; ')}`)
    if (r.dream?.trim())            parts.push(`Мечта: ${r.dream.trim()}`)
    return parts.join('\n')
  }

  // Fetch ALL existing students (active + departed)
  const { data: existingStudents } = await db
    .from('students').select('id, full_name, status').eq('school_id', schoolId)

  const activeMap = new Map<string, string>()
  const departedMap = new Map<string, string>()
  for (const s of existingStudents ?? []) {
    if (s.status === 'active') activeMap.set(norm(s.full_name), s.id)
    else departedMap.set(norm(s.full_name), s.id)
  }

  const toInsert: QuestionnaireRow[] = []
  const toReactivate: QuestionnaireRow[] = []
  const alreadyActive: QuestionnaireRow[] = []

  for (const r of validRows) {
    const key = norm(r.full_name)
    if (activeMap.has(key))        alreadyActive.push(r)
    else if (departedMap.has(key)) toReactivate.push(r)
    else                           toInsert.push(r)
  }

  const nameToId: Record<string, string> = {}

  const profileFields = (r: QuestionnaireRow, extra?: object) => ({
    class_id:         r.class_name?.trim() ? (classMap[r.class_name.trim()] ?? null) : null,
    parent_name:      r.parent_name?.trim()      || null,
    parent_phone:     r.parent_phone?.trim()     || null,
    goals:            r.goals ?? [],
    family_situation: r.family_situation?.trim() || null,
    health_status:    r.health_status?.trim()    || null,
    parent_goal:      r.parent_goal?.trim()      || null,
    enrollment_year:  r.enrollment_year?.trim()  || null,
    dream:            r.dream?.trim()             || null,
    ...extra,
  })

  // 1. Reactivate departed students
  for (const r of toReactivate) {
    const key = norm(r.full_name)
    const id = departedMap.get(key)!
    await db.from('students').update(profileFields(r, { status: 'active' })).eq('id', id)
    nameToId[key] = id
  }

  // 2. Update profile for already-active students
  for (const r of alreadyActive) {
    const key = norm(r.full_name)
    const id = activeMap.get(key)!
    await db.from('students').update(profileFields(r)).eq('id', id)
    nameToId[key] = id
  }

  // 3. Insert new students
  if (toInsert.length > 0) {
    const payload = toInsert.map(r => ({
      school_id: schoolId,
      full_name: r.full_name.trim(),
      status:    'active',
      risk_level: 'none',
      ...profileFields(r),
    }))
    const { data: inserted, error } = await db.from('students').insert(payload).select('id, full_name')
    if (error) return { imported: 0, error: 'Ошибка при импорте: ' + error.message }
    for (const s of inserted ?? []) nameToId[norm(s.full_name)] = s.id
  }

  // 4. Replace questionnaire observations for ALL processed students
  const allStudentIds = Object.values(nameToId)
  let obsCount = 0

  if (allStudentIds.length > 0) {
    await db.from('observations')
      .delete()
      .in('student_id', allStudentIds)
      .eq('source', 'questionnaire')

    const obsToInsert = validRows.flatMap(r => {
      const studentId = nameToId[norm(r.full_name)]
      if (!studentId) return []
      const content = buildObsContent(r)
      if (!content) return []
      return [{ student_id: studentId, author_id: user.id, category: 'academic', content, is_alert: false, source: 'questionnaire' }]
    })

    if (obsToInsert.length > 0) {
      const { error: obsErr } = await db.from('observations').insert(obsToInsert)
      if (obsErr) return { imported: 0, error: 'Ошибка при сохранении наблюдений: ' + obsErr.message }
      obsCount = obsToInsert.length
    }
  }

  // Generate AI summaries for all processed students in parallel
  if (process.env.ANTHROPIC_API_KEY && allStudentIds.length > 0) {
    const { data: questObs } = await db
      .from('observations')
      .select('student_id, content')
      .in('student_id', allStudentIds)
      .eq('source', 'questionnaire')

    const obsMap = Object.fromEntries((questObs ?? []).map(o => [o.student_id as string, o.content as string]))

    // Only generate summaries for students that don't already have one. This preserves
    // summaries already enriched by manual observations (re-import must not reset them).
    const { data: existingInsights } = await db
      .from('ai_insights').select('student_id').in('student_id', allStudentIds)
    const hasInsights = new Set((existingInsights ?? []).map(r => r.student_id as string))

    await Promise.allSettled(
      validRows.map(async (r) => {
        const studentId = nameToId[norm(r.full_name)]
        const content = studentId ? obsMap[studentId] : undefined
        if (!studentId || !content || hasInsights.has(studentId)) return

        const summaries = await generateInitialSummaries(r.full_name.trim(), content)
        if (!summaries) return

        await db.from('ai_insights').upsert(
          { student_id: studentId, school_id: schoolId, ...summaries },
          { onConflict: 'student_id' }
        )

        // История версий сводок (кроме «Обзора» и пустых разделов)
        const versionRows = Object.entries(summaries)
          .filter(([k, v]) => k !== 'overview' && k !== 'generated_at' && typeof v === 'string' && v && v !== NO_DATA)
          .map(([section, content]) => ({ student_id: studentId, school_id: schoolId, section, content: content as string }))
        if (versionRows.length > 0) await db.from('ai_insight_versions').insert(versionRows)
      })
    )
  }

  revalidatePath('/students')
  return { imported: toInsert.length + toReactivate.length, skipped: alreadyActive.length, observations: obsCount }
}

export async function importStudents(rows: ImportRow[]): Promise<{ imported: number; skipped?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { imported: 0, error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users').select('school_id').eq('id', user.id).single()
  if (!profile?.school_id) return { imported: 0, error: 'Школа не найдена' }

  const schoolId = profile.school_id

  // Build class name → id map (fetch existing then create missing)
  const classNames = [...new Set(rows.map(r => r.class_name?.trim()).filter(isClassName))] as string[]
  const classMap: Record<string, string> = {}

  if (classNames.length > 0) {
    const { data: existing } = await supabase
      .from('classes').select('id, name').eq('school_id', schoolId).in('name', classNames)
    for (const c of existing ?? []) classMap[c.name] = c.id

    for (const name of classNames) {
      if (classMap[name]) continue
      // Ведущие цифры = параллель, остаток = буква (может быть пустым для «10» без секции).
      // ВАЖНО: (.+) жадно откусывал последнюю цифру у «10» → grade=1, letter=«0». Используем (.*).
      const match = name.match(/^(\d+)(.*)$/)
      const grade = match ? parseInt(match[1]) : 0
      const letter = match ? match[2].trim() : name
      const { data: cls } = await supabase
        .from('classes').insert({ school_id: schoolId, name, grade, letter }).select('id').single()
      if (cls) classMap[name] = cls.id
    }
  }

  const validRows = rows.filter(r => r.full_name?.trim())
  if (validRows.length === 0) return { imported: 0, error: 'Нет данных для импорта' }

  // Fetch existing student names to skip duplicates
  const { data: existingStudents } = await supabase
    .from('students').select('full_name').eq('school_id', schoolId)
  const existingNames = new Set(
    (existingStudents ?? []).map(s => s.full_name.toLowerCase().replace(/\s+/g, ' ').trim())
  )

  const toInsert = validRows
    .filter(r => !existingNames.has(r.full_name.trim().toLowerCase().replace(/\s+/g, ' ')))
    .map(r => ({
      school_id: schoolId,
      full_name: r.full_name.trim(),
      class_id: r.class_name?.trim() ? (classMap[r.class_name.trim()] ?? null) : null,
      parent_name: r.parent_name?.trim() || null,
      parent_phone: r.parent_phone?.trim() || null,
      status: 'active',
      risk_level: 'none',
      goals: [],
    }))

  if (toInsert.length === 0) return { imported: 0, skipped: validRows.length }

  const { error } = await supabase.from('students').insert(toInsert)
  if (error) return { imported: 0, error: 'Ошибка при импорте: ' + error.message }

  revalidatePath('/students')
  return { imported: toInsert.length, skipped: validRows.length - toInsert.length }
}
