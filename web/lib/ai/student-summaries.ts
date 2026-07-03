import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const NO_DATA = 'Данных пока недостаточно.'

// Maps our UI section keys to ai_insights table columns
export const SECTION_TO_COL = {
  overview:     'overview',
  interests:    'interests',
  performance:  'academic',
  activity:     'extracurricular',
  achievements: 'achievements',
  psychology:   'psychology',
} as const

export type SectionKey = keyof typeof SECTION_TO_COL
export type AiInsightRow = { [K in typeof SECTION_TO_COL[SectionKey]]?: string | null } & {
  overview?: string | null
  interests?: string | null
  academic?: string | null
  extracurricular?: string | null
  achievements?: string | null
  psychology?: string | null
  generated_at?: string | null
}

const SECTION_LABEL: Record<SectionKey, string> = {
  overview:     'Обзор',
  interests:    'Интересы',
  performance:  'Успеваемость',
  activity:     'Активность',
  achievements: 'Достижения',
  psychology:   'Психология',
}

// Единственный источник определений разделов. ВАЖНО: при изменении синхронизировать
// с копией в supabase/functions/nightly-ai-update/index.ts (Deno не импортирует web/lib).
export const SECTION_DEFINITIONS = `Определения разделов (строго соблюдай — не помещай информацию в неподходящий раздел):
- overview (Обзор): общий портрет ученика — ключевые черты и краткое резюме. Без дублирования деталей из других разделов.
- interests (Интересы): хобби, увлечения, любимые предметы, чем нравится заниматься. НЕ оценки и НЕ достигнутые результаты.
- performance (Успеваемость): учебные результаты — оценки, сильные и слабые предметы, стиль и привычки учёбы, трудности в обучении.
- activity (Активность): внеурочная вовлечённость — кружки, секции, мероприятия, работа в группе, социальная активность. НЕ сами награды.
- achievements (Достижения): конкретные достигнутые результаты — победы, призовые места, олимпиады, грамоты, конкурсы. Только реально достигнутое.
- psychology (Психология): эмоциональное состояние, мотивация, самооценка, страхи, реакция на критику и неудачи, общение, конфликты, влияние семьи.

Если информация раздела не касается — НЕ меняй этот раздел.`

export async function generateInitialSummaries(
  fullName: string,
  obsContent: string
): Promise<AiInsightRow | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Ты опытный классный руководитель и педагог-психолог. На основе данных анкет составь краткие профессиональные сводки об ученике по 6 разделам профиля, строго распределяя информацию согласно определениям ниже. Пиши от третьего лица, на русском, 2-3 предложения на раздел. Если данных для раздела недостаточно — напиши ровно: "${NO_DATA}"

${SECTION_DEFINITIONS}

Ученик: ${fullName}

Данные анкет:
${obsContent}

Ответь ТОЛЬКО валидным JSON без markdown и пояснений:
{"overview":"...","interests":"...","performance":"...","activity":"...","achievements":"...","psychology":"..."}`,
    }],
  })

  try {
    const text = (response.content[0] as { type: string; text: string }).text.trim()
    const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(json) as Record<SectionKey, string>

    // Map section keys → DB column names
    return {
      overview:       parsed.overview,
      interests:      parsed.interests,
      academic:       parsed.performance,
      extracurricular:parsed.activity,
      achievements:   parsed.achievements,
      psychology:     parsed.psychology,
      generated_at:   new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export async function updateSummariesFromObservations(
  fullName: string,
  current: AiInsightRow,
  newObs: string[]
): Promise<Partial<AiInsightRow> | null> {
  if (!process.env.ANTHROPIC_API_KEY || newObs.length === 0) return null

  const currentText = (Object.keys(SECTION_LABEL) as SectionKey[])
    .map(k => `${SECTION_LABEL[k]}: ${current[SECTION_TO_COL[k]] ?? NO_DATA}`)
    .join('\n')

  const obsText = newObs.map((o, i) => `${i + 1}. ${o}`).join('\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Ты опытный классный руководитель. Тебе дали текущие AI сводки по ученику и новые наблюдения учителей за сегодня. Обнови только те разделы, которых явно касаются новые наблюдения.

Для каждого такого раздела ПЕРЕПИШИ сводку заново как краткую актуальную выжимку на 3-4 предложения, объединив важное из текущей сводки с новыми наблюдениями. Сохраняй значимое, но убирай устаревшее и второстепенное — раздел должен оставаться компактным и НЕ расти со временем. Это живая сводка, а не журнал: не приклеивай новое в хвост, а синтезируй цельный обновлённый текст. Пиши на русском, от третьего лица.

Ученик: ${fullName}

Текущие AI сводки:
${currentText}

Новые наблюдения учителей за сегодня:
${obsText}

${SECTION_DEFINITIONS}
Обновляй раздел только если новое наблюдение явно соответствует его определению.

Ответь ТОЛЬКО валидным JSON без markdown, только с разделами которые нужно обновить:
{"section_key":"цельная обновлённая выжимка (3-4 предложения)"}`,
    }],
  })

  try {
    const text = (response.content[0] as { type: string; text: string }).text.trim()
    const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(json) as Partial<Record<SectionKey, string>>

    // Map section keys → DB column names
    const result: Partial<AiInsightRow> = {}
    for (const [k, v] of Object.entries(parsed) as [SectionKey, string][]) {
      if (SECTION_TO_COL[k]) result[SECTION_TO_COL[k]] = v
    }
    if (Object.keys(result).length > 0) result.generated_at = new Date().toISOString()
    return result
  } catch (e) {
    // Чаще всего это обрыв ответа по max_tokens → невалидный JSON. Раньше падало
    // молча (return null) и обновление терялось незаметно — теперь хотя бы видно в логах.
    console.error(`[ai] updateSummariesFromObservations: не удалось разобрать ответ для «${fullName}»:`, e)
    return null
  }
}

// Пересобирает «Обзор» как общий портрет из актуальных 5 разделов. Обзор почти не
// задевается ежедневными наблюдениями (они уходят в профильные разделы) и потому
// устаревает — эта функция держит его синхронным с остальным профилем.
export async function regenerateOverview(
  fullName: string,
  sections: AiInsightRow
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const body = (['interests', 'performance', 'activity', 'achievements', 'psychology'] as SectionKey[])
    .map(k => `${SECTION_LABEL[k]}: ${sections[SECTION_TO_COL[k]] ?? NO_DATA}`)
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
    console.error(`[ai] regenerateOverview: сбой для «${fullName}»:`, e)
    return null
  }
}
