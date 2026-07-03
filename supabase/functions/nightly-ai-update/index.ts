import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
const supabase  = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const SECTIONS = ['overview','interests','performance','activity','achievements','psychology'] as const
type Section = typeof SECTIONS[number]
const NO_DATA = 'Данных пока недостаточно.'

const SECTION_RU: Record<Section, string> = {
  overview: 'Обзор', interests: 'Интересы', performance: 'Успеваемость',
  activity: 'Активность', achievements: 'Достижения', psychology: 'Психология',
}

// UI section keys → ai_insights table columns
const COL_BY_SECTION: Record<Section, string> = {
  overview: 'overview', interests: 'interests', performance: 'academic',
  activity: 'extracurricular', achievements: 'achievements', psychology: 'psychology',
}

// КОПИЯ SECTION_DEFINITIONS из web/lib/ai/student-summaries.ts — держать синхронным.
const SECTION_DEFINITIONS = `Определения разделов (строго соблюдай — не помещай информацию в неподходящий раздел):
- overview (Обзор): общий портрет ученика — ключевые черты и краткое резюме. Без дублирования деталей из других разделов.
- interests (Интересы): хобби, увлечения, любимые предметы, чем нравится заниматься. НЕ оценки и НЕ достигнутые результаты.
- performance (Успеваемость): учебные результаты — оценки, сильные и слабые предметы, стиль и привычки учёбы, трудности в обучении.
- activity (Активность): внеурочная вовлечённость — кружки, секции, мероприятия, работа в группе, социальная активность. НЕ сами награды.
- achievements (Достижения): конкретные достигнутые результаты — победы, призовые места, олимпиады, грамоты, конкурсы. Только реально достигнутое.
- psychology (Психология): эмоциональное состояние, мотивация, самооценка, страхи, реакция на критику и неудачи, общение, конфликты, влияние семьи.

Если информация раздела не касается — НЕ меняй этот раздел.`

// Пересобирает «Обзор» как общий портрет из актуальных 5 разделов — он почти не
// задевается ежедневными наблюдениями (они уходят в профильные разделы) и устаревает.
async function regenerateOverview(fullName: string, sections: Partial<Record<Section, string>>): Promise<string | null> {
  const body = (['interests', 'performance', 'activity', 'achievements', 'psychology'] as Section[])
    .map(s => `${SECTION_RU[s]}: ${sections[s] ?? NO_DATA}`)
    .join('\n')
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Ты опытный классный руководитель. На основе актуальных разделов профиля составь «Обзор» — общий портрет ученика: ключевые черты и краткое резюме на 3-4 предложения. Дай ОБОБЩЁННЫЙ портрет, не дублируй детали из разделов дословно. Пиши от третьего лица, на русском. Если данных мало — напиши ровно: "${NO_DATA}"

Ученик: ${fullName}

Актуальные разделы:
${body}

Ответь ТОЛЬКО текстом обзора — без JSON, без markdown, без префиксов.`,
      }],
    })
    const text = (response.content[0] as { type: string; text: string }).text.trim()
    return text || null
  } catch (e) {
    console.error(`[ai] nightly regenerateOverview: сбой для ${fullName}:`, e)
    return null
  }
}

Deno.serve(async (req) => {
  // Allow only POST from Supabase cron (or authorized caller)
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    // Runs nightly at 21:00 Bishkek (UTC+6) = 15:00 UTC. Pick up observations from the last 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Fetch all manual observations added since yesterday 21:00
    const { data: newObs, error: obsErr } = await supabase
      .from('observations')
      .select('id, student_id, content, students!inner(full_name, school_id)')
      .eq('source', 'manual')
      .gte('created_at', since)

    if (obsErr) throw obsErr
    if (!newObs || newObs.length === 0) {
      return new Response(JSON.stringify({ message: 'No new observations' }), { status: 200 })
    }

    // Group observations by student
    const byStudent = new Map<string, { fullName: string; schoolId: string; obsTexts: string[] }>()
    for (const o of newObs) {
      const student = o.students as { full_name: string; school_id: string }
      if (!byStudent.has(o.student_id)) {
        byStudent.set(o.student_id, { fullName: student.full_name, schoolId: student.school_id, obsTexts: [] })
      }
      byStudent.get(o.student_id)!.obsTexts.push(o.content)
    }

    let updatedStudents = 0

    // Process each student in parallel
    await Promise.allSettled(
      Array.from(byStudent.entries()).map(async ([studentId, { fullName, schoolId, obsTexts }]) => {
        // Fetch current summaries (wide ai_insights row)
        const { data: currentRow } = await supabase
          .from('ai_insights')
          .select('overview, interests, academic, extracurricular, achievements, psychology')
          .eq('student_id', studentId)
          .maybeSingle()

        const current: Partial<Record<Section, string>> = {}
        for (const s of SECTIONS) {
          const v = currentRow?.[COL_BY_SECTION[s] as keyof typeof currentRow] as string | null | undefined
          if (v) current[s] = v
        }

        const currentText = SECTIONS
          .map(s => `${SECTION_RU[s]}: ${current[s] ?? NO_DATA}`)
          .join('\n')

        const obsText = obsTexts.map((o, i) => `${i + 1}. ${o}`).join('\n\n')

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Ты опытный классный руководитель. Тебе дали текущие AI сводки по ученику и новые наблюдения учителей за сегодня. Обнови только те разделы, которых явно касаются новые наблюдения.

Для каждого такого раздела ПЕРЕПИШИ сводку заново как краткую актуальную выжимку на 3-4 предложения, объединив важное из текущей сводки с новыми наблюдениями. Сохраняй значимое, но убирай устаревшее и второстепенное — раздел должен оставаться компактным и НЕ расти со временем. Это живая сводка, а не журнал: синтезируй цельный обновлённый текст, не приклеивай новое в хвост. Пиши на русском, от третьего лица.

Ученик: ${fullName}

Текущие сводки:
${currentText}

Новые наблюдения за сегодня:
${obsText}

${SECTION_DEFINITIONS}
Обновляй раздел только если новое наблюдение явно соответствует его определению.

Ответь ТОЛЬКО валидным JSON без markdown, только с обновлёнными разделами:
{"section_key":"цельная обновлённая выжимка (3-4 предложения)"}`,
          }],
        })

        let updates: Partial<Record<Section, string>>
        try {
          const text = (response.content[0] as { type: string; text: string }).text.trim()
          const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '')
          updates = JSON.parse(json) as Partial<Record<Section, string>>
        } catch (e) {
          // Обычно обрыв по max_tokens → невалидный JSON. Логируем, а не теряем молча.
          console.error(`[ai] nightly: не удалось разобрать ответ для ${fullName}:`, e)
          return
        }

        // Map section keys → ai_insights columns; only keep recognised sections
        const colUpdates: Record<string, string> = {}
        for (const [section, content] of Object.entries(updates)) {
          if (SECTIONS.includes(section as Section) && content) {
            colUpdates[COL_BY_SECTION[section as Section]] = content
          }
        }

        if (Object.keys(colUpdates).length > 0) {
          // Пересобираем «Обзор» из актуальных разделов (в историю версий он не пишется — см. фильтр ниже).
          const mergedSections = { ...current, ...updates } as Partial<Record<Section, string>>
          const newOverview = await regenerateOverview(fullName, mergedSections)
          if (newOverview) colUpdates[COL_BY_SECTION.overview] = newOverview

          await supabase
            .from('ai_insights')
            .upsert(
              { student_id: studentId, school_id: schoolId, ...colUpdates, generated_at: new Date().toISOString() },
              { onConflict: 'student_id' },
            )

          // История версий: каждое обновлённое поле — новая версия (кроме «Обзора»).
          const versionRows = Object.entries(colUpdates)
            .filter(([section]) => section !== 'overview')
            .map(([section, content]) => ({ student_id: studentId, school_id: schoolId, section, content }))
          if (versionRows.length > 0) await supabase.from('ai_insight_versions').insert(versionRows)
          updatedStudents++
        }
      })
    )

    return new Response(
      JSON.stringify({ message: `Updated ${updatedStudents} students` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
