import { createAdminClient } from '@/lib/supabase/admin'
import { updateSummariesFromObservations, regenerateOverview, type AiInsightRow } from '@/lib/ai/student-summaries'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Ежедневный крон: обновляет ИИ-сводки по наблюдениям за последние 24 часа
// и пишет историю версий. Запускается Vercel Cron (см. vercel.json).
export async function GET(req: Request) {
  // Vercel добавляет заголовок Authorization: Bearer <CRON_SECRET>, если задан env CRON_SECRET.
  // Без CRON_SECRET эндпоинт закрыт совсем: иначе любой мог бы запускать платные AI-запросы.
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const db = createAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: newObs, error } = await db
    .from('observations')
    .select('student_id, content, students!inner(full_name, school_id)')
    .eq('source', 'manual')
    .gte('created_at', since)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!newObs || newObs.length === 0) return Response.json({ message: 'No new observations' })

  // Группируем наблюдения по ученику
  const byStudent = new Map<string, { fullName: string; schoolId: string; texts: string[] }>()
  for (const o of newObs as unknown as { student_id: string; content: string; students: { full_name: string; school_id: string } | { full_name: string; school_id: string }[] }[]) {
    const s = Array.isArray(o.students) ? o.students[0] : o.students
    if (!s) continue
    if (!byStudent.has(o.student_id)) byStudent.set(o.student_id, { fullName: s.full_name, schoolId: s.school_id, texts: [] })
    byStudent.get(o.student_id)!.texts.push(o.content)
  }

  let updated = 0
  await Promise.allSettled(
    Array.from(byStudent.entries()).map(async ([studentId, { fullName, schoolId, texts }]) => {
      const { data: current } = await db
        .from('ai_insights')
        .select('overview, interests, academic, extracurricular, achievements, psychology, generated_at')
        .eq('student_id', studentId)
        .maybeSingle()

      const updates = await updateSummariesFromObservations(fullName, (current ?? {}) as AiInsightRow, texts)
      if (!updates) return

      // Пересобираем «Обзор» из актуальных разделов (сам он ежедневными наблюдениями
      // почти не задевается и устаревает). Обзор в историю версий не пишем — см. фильтр ниже.
      const merged = { ...(current ?? {}), ...updates } as AiInsightRow
      const newOverview = await regenerateOverview(fullName, merged)
      if (newOverview) updates.overview = newOverview

      await db.from('ai_insights').upsert(
        { student_id: studentId, school_id: schoolId, ...updates },
        { onConflict: 'student_id' },
      )

      // История версий (кроме «Обзора»)
      const versionRows = Object.entries(updates)
        .filter(([k, v]) => k !== 'overview' && k !== 'generated_at' && typeof v === 'string' && v)
        .map(([section, content]) => ({ student_id: studentId, school_id: schoolId, section, content: content as string }))
      if (versionRows.length > 0) await db.from('ai_insight_versions').insert(versionRows)

      updated++
    }),
  )

  return Response.json({ message: `Updated ${updated} students` })
}
