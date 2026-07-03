import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

// Контекст исполнения инструментов: клиент Supabase (RLS директора) + его школа.
// Все инструменты read-only и жёстко scoped к schoolId — ассистент не может
// выйти за пределы своей школы и ничего не меняет.
export interface ToolContext {
  supabase: SupabaseClient
  schoolId: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

const CATEGORY_RU: Record<string, string> = {
  academic: 'Академическое', behavior: 'Поведение', psychology: 'Психология',
  sport: 'Спорт', creative: 'Творчество', health: 'Здоровье', social: 'Социальное',
}

// Подрезаем длинный текст, чтобы результаты инструментов не раздували токены.
const clip = (s: unknown, n = 200): string | null => {
  const t = (s ?? '').toString().trim()
  if (!t) return null
  return t.length > n ? t.slice(0, n).trimEnd() + '…' : t
}

// ── Определения инструментов для Claude ──────────────────────────────────────
export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_school_overview',
    description: 'Общая сводка по школе: количество активных учеников, классов, педагогов, учеников с высоким риском, всего наблюдений и тревожных сигналов, сколько учеников без наблюдений 14+ дней. Начинай с этого инструмента для общих вопросов о состоянии школы.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_at_risk_students',
    description: 'Список учеников в зоне риска — тех, у кого давно (14+ дней) не было наблюдений, а также с высоким уровнем риска. Возвращает имя, класс и сколько дней без наблюдений. Используй для вопросов «кто в зоне риска», «на кого обратить внимание».',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_class_stats',
    description: 'Статистика по каждому классу за последние 30 дней: число учеников, наблюдений, тревожных сигналов, учеников без недавних наблюдений. Для вопросов сравнения классов и поиска проблемных классов.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'find_students',
    description: 'Поиск учеников по имени и/или фильтрам. Возвращает id, имя, класс, уровень риска. Используй, чтобы найти ученика перед запросом деталей, или получить список по классу/уровню риска.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Часть ФИО ученика (необязательно)' },
        class_name: { type: 'string', description: 'Имя класса, напр. «10А» (необязательно)' },
        risk_level: { type: 'string', enum: ['high', 'medium', 'low', 'none'], description: 'Фильтр по уровню риска (необязательно)' },
      },
    },
  },
  {
    name: 'search_student_profiles',
    description: 'Поиск учеников по СОДЕРЖАНИЮ их профиля — сильным предметам, интересам, достижениям, чертам. Используй для подбора: «кто силён в физике», «кого отправить на олимпиаду по математике», «у кого есть спортивные достижения», «кто увлекается программированием». Передай ключевое слово (предмет/тему/направление, напр. «физик», «математик», «олимпиад», «шахмат»). Ищет по AI-сводкам (успеваемость, интересы, достижения, обзор). Дополняет search_observations, который ищет по тексту наблюдений.',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Предмет, тема или направление, напр. «физик», «математик», «спорт», «олимпиад»' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'get_student_details',
    description: 'Подробности по конкретному ученику: AI-сводки по всем разделам профиля (обзор, интересы, успеваемость, активность, достижения, психология), уровень риска, класс и последние наблюдения учителей. Передай student_id (из find_students) ИЛИ точное имя.',
    input_schema: {
      type: 'object',
      properties: {
        student_id: { type: 'string', description: 'ID ученика из find_students (предпочтительно)' },
        student_name: { type: 'string', description: 'ФИО ученика, если id неизвестен' },
      },
    },
  },
  {
    name: 'search_observations',
    description: 'Поиск по наблюдениям учителей за период. Фильтры: ключевое слово в тексте, категория, только тревожные, за сколько дней. Возвращает ученика, класс, автора, категорию, текст, дату. Для вопросов о конкретных событиях и инцидентах.',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Слово/фраза для поиска в тексте наблюдения (необязательно)' },
        category: { type: 'string', enum: ['academic', 'behavior', 'psychology', 'sport', 'creative', 'health', 'social'], description: 'Категория (необязательно)' },
        only_alerts: { type: 'boolean', description: 'Только тревожные наблюдения (необязательно)' },
        days: { type: 'number', description: 'За последние N дней (по умолчанию 30)' },
      },
    },
  },
  {
    name: 'get_teacher_activity',
    description: 'Активность педагогов за последние 30 дней: сколько наблюдений добавил каждый и когда было последнее. Для вопросов «кто из учителей активен/неактивен», «кто давно не писал наблюдений».',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_latest_school_report',
    description: 'Последний ежемесячный AI-отчёт по школе: климат, классы под вниманием, тренды месяца, рекомендации директору. Для вопросов о выводах прошлого месяца.',
    input_schema: { type: 'object', properties: {} },
  },
]

// ── Вспомогательное ──────────────────────────────────────────────────────────
async function activeStudents(ctx: ToolContext): Promise<{ id: string; full_name: string; risk_level: string; class_id: string | null }[]> {
  const { data } = await ctx.supabase
    .from('students')
    .select('id, full_name, risk_level, class_id')
    .eq('school_id', ctx.schoolId)
    .eq('status', 'active')
  return data ?? []
}

async function classNameMap(ctx: ToolContext): Promise<Record<string, string>> {
  const { data } = await ctx.supabase.from('classes').select('id, name').eq('school_id', ctx.schoolId)
  const map: Record<string, string> = {}
  for (const c of data ?? []) map[c.id] = c.name
  return map
}

// ── Исполнитель инструментов ──────────────────────────────────────────────────
export async function executeAssistantTool(name: string, input: Json, ctx: ToolContext): Promise<Json> {
  switch (name) {
    case 'get_school_overview': {
      const studs = await activeStudents(ctx)
      const ids = studs.map(s => s.id)
      const highRisk = studs.filter(s => s.risk_level === 'high').length
      const [classesC, obsC, alertsC, staffC, noRecent] = await Promise.all([
        ctx.supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', ctx.schoolId),
        ids.length ? ctx.supabase.from('observations').select('id', { count: 'exact', head: true }).eq('source', 'manual').in('student_id', ids) : Promise.resolve({ count: 0 }),
        ids.length ? ctx.supabase.from('observations').select('id', { count: 'exact', head: true }).eq('source', 'manual').eq('is_alert', true).in('student_id', ids) : Promise.resolve({ count: 0 }),
        ctx.supabase.from('users').select('id', { count: 'exact', head: true }).eq('school_id', ctx.schoolId),
        ctx.supabase.rpc('get_students_no_recent_obs', { p_school_id: ctx.schoolId }),
      ])
      return {
        active_students: studs.length,
        classes: classesC.count ?? 0,
        staff: staffC.count ?? 0,
        high_risk_students: highRisk,
        total_observations: obsC.count ?? 0,
        alert_observations: alertsC.count ?? 0,
        students_without_recent_observations: (noRecent.data ?? []).length,
      }
    }

    case 'list_at_risk_students': {
      const { data: noRecent } = await ctx.supabase.rpc('get_students_no_recent_obs', { p_school_id: ctx.schoolId })
      const list = (noRecent ?? []).map((r: Json) => ({
        name: r.full_name, class: r.class_name, days_since_last_observation: r.days_since,
      }))
      return { at_risk_count: list.length, students: list.slice(0, 50) }
    }

    case 'get_class_stats': {
      const studs = await activeStudents(ctx)
      const cmap = await classNameMap(ctx)
      const ids = studs.map(s => s.id)
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: obs } = ids.length
        ? await ctx.supabase.from('observations').select('student_id, is_alert').eq('source', 'manual').in('student_id', ids).gte('created_at', since30d)
        : { data: [] as Json[] }
      const perStudent: Record<string, { total: number; alerts: number }> = {}
      for (const o of obs ?? []) {
        if (!perStudent[o.student_id]) perStudent[o.student_id] = { total: 0, alerts: 0 }
        perStudent[o.student_id].total++
        if (o.is_alert) perStudent[o.student_id].alerts++
      }
      const byClass: Record<string, { students: number; observations: number; alerts: number; high_risk: number }> = {}
      for (const s of studs) {
        const cname = s.class_id ? (cmap[s.class_id] ?? 'Без класса') : 'Без класса'
        if (!byClass[cname]) byClass[cname] = { students: 0, observations: 0, alerts: 0, high_risk: 0 }
        byClass[cname].students++
        byClass[cname].observations += perStudent[s.id]?.total ?? 0
        byClass[cname].alerts += perStudent[s.id]?.alerts ?? 0
        if (s.risk_level === 'high') byClass[cname].high_risk++
      }
      return { period_days: 30, classes: Object.entries(byClass).map(([name, v]) => ({ class: name, ...v })) }
    }

    case 'find_students': {
      const cmap = await classNameMap(ctx)
      let q = ctx.supabase.from('students')
        .select('id, full_name, risk_level, class_id')
        .eq('school_id', ctx.schoolId).eq('status', 'active')
      if (input.query) q = q.ilike('full_name', `%${input.query}%`)
      if (input.risk_level) q = q.eq('risk_level', input.risk_level)
      if (input.class_name) {
        const classId = Object.entries(cmap).find(([, n]) => n.toLowerCase() === String(input.class_name).toLowerCase())?.[0]
        if (classId) q = q.eq('class_id', classId)
        else return { count: 0, students: [], note: `Класс «${input.class_name}» не найден` }
      }
      const { data } = await q.order('full_name').limit(50)
      return {
        count: (data ?? []).length,
        students: (data ?? []).map((s: Json) => ({
          id: s.id, name: s.full_name, class: s.class_id ? (cmap[s.class_id] ?? null) : null, risk_level: s.risk_level,
        })),
      }
    }

    case 'search_student_profiles': {
      const kw = String(input.keyword ?? '').replace(/[,()*%]/g, ' ').trim()
      if (!kw) return { error: 'Укажите ключевое слово (предмет/тему/направление)' }
      const like = `%${kw}%`
      // Ищем ключевое слово по текстовым разделам AI-сводки. ai_insights.school_id
      // scoped к школе, students!inner — только активные ученики этой школы.
      const { data } = await ctx.supabase.from('ai_insights')
        .select('interests, academic, achievements, overview, students!inner(full_name, status, class_id, school_id, class:classes(name))')
        .eq('school_id', ctx.schoolId)
        .eq('students.status', 'active')
        .or(`interests.ilike.${like},academic.ilike.${like},achievements.ilike.${like},overview.ilike.${like}`)
        .limit(20)
      const students = (data ?? []).map((r: Json) => {
        const s = Array.isArray(r.students) ? r.students[0] : r.students
        return {
          name: s?.full_name,
          class: Array.isArray(s?.class) ? s?.class[0]?.name : s?.class?.name,
          interests: clip(r.interests),
          performance: clip(r.academic),
          achievements: clip(r.achievements),
        }
      })
      return {
        keyword: kw,
        count: students.length,
        students,
        note: students.length === 0 ? 'Никого не нашлось по этому запросу в AI-профилях. Можно попробовать search_observations по тексту наблюдений.' : undefined,
      }
    }

    case 'get_student_details': {
      const cmap = await classNameMap(ctx)
      let studentId = input.student_id as string | undefined
      let student: Json = null
      if (!studentId && input.student_name) {
        const { data } = await ctx.supabase.from('students')
          .select('id, full_name, risk_level, class_id')
          .eq('school_id', ctx.schoolId).eq('status', 'active')
          .ilike('full_name', `%${input.student_name}%`).limit(5)
        if (!data || data.length === 0) return { error: `Ученик «${input.student_name}» не найден` }
        if (data.length > 1) return { ambiguous: true, matches: data.map((s: Json) => ({ id: s.id, name: s.full_name, class: s.class_id ? cmap[s.class_id] : null })) }
        student = data[0]; studentId = student.id
      } else if (studentId) {
        const { data } = await ctx.supabase.from('students')
          .select('id, full_name, risk_level, class_id')
          .eq('school_id', ctx.schoolId).eq('id', studentId).maybeSingle()
        student = data
      }
      if (!student || !studentId) return { error: 'Ученик не найден' }

      const [insightsRes, obsRes] = await Promise.all([
        ctx.supabase.from('ai_insights')
          .select('overview, interests, academic, extracurricular, achievements, psychology, generated_at')
          .eq('student_id', studentId).maybeSingle(),
        ctx.supabase.from('observations')
          .select('content, category, is_alert, created_at, author:users(full_name)')
          .eq('source', 'manual').eq('student_id', studentId)
          .order('created_at', { ascending: false }).limit(10),
      ])
      const ins = insightsRes.data as Json
      return {
        name: student.full_name,
        class: student.class_id ? (cmap[student.class_id] ?? null) : null,
        risk_level: student.risk_level,
        ai_summary: ins ? {
          overview: ins.overview, interests: ins.interests, performance: ins.academic,
          activity: ins.extracurricular, achievements: ins.achievements, psychology: ins.psychology,
        } : null,
        recent_observations: (obsRes.data ?? []).slice(0, 8).map((o: Json) => ({
          date: (o.created_at as string)?.slice(0, 10),
          category: CATEGORY_RU[o.category] ?? o.category,
          is_alert: o.is_alert,
          author: Array.isArray(o.author) ? o.author[0]?.full_name : o.author?.full_name,
          text: clip(o.content, 300),
        })),
      }
    }

    case 'search_observations': {
      const days = typeof input.days === 'number' ? input.days : 30
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      let q = ctx.supabase.from('observations')
        .select('content, category, is_alert, created_at, students!inner(full_name, school_id, class:classes(name)), author:users(full_name)')
        .eq('source', 'manual').eq('students.school_id', ctx.schoolId)
        .gte('created_at', since)
      if (input.keyword) q = q.ilike('content', `%${input.keyword}%`)
      if (input.category) q = q.eq('category', input.category)
      if (input.only_alerts) q = q.eq('is_alert', true)
      const { data } = await q.order('created_at', { ascending: false }).limit(20)
      return {
        count: (data ?? []).length,
        observations: (data ?? []).map((o: Json) => {
          const s = Array.isArray(o.students) ? o.students[0] : o.students
          return {
            date: (o.created_at as string)?.slice(0, 10),
            student: s?.full_name,
            class: Array.isArray(s?.class) ? s?.class[0]?.name : s?.class?.name,
            category: CATEGORY_RU[o.category] ?? o.category,
            is_alert: o.is_alert,
            author: Array.isArray(o.author) ? o.author[0]?.full_name : o.author?.full_name,
            text: clip(o.content, 220),
          }
        }),
      }
    }

    case 'get_teacher_activity': {
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const [staffRes, obsRes] = await Promise.all([
        ctx.supabase.from('users').select('id, full_name, role').eq('school_id', ctx.schoolId)
          .in('role', ['deputy', 'class_teacher', 'teacher', 'psychologist', 'nurse', 'security']),
        ctx.supabase.from('observations')
          .select('author_id, created_at, students!inner(school_id)')
          .eq('source', 'manual').eq('students.school_id', ctx.schoolId).gte('created_at', since30d),
      ])
      const stat: Record<string, { total: number; last: string }> = {}
      for (const o of (obsRes.data ?? []) as Json[]) {
        const a = o.author_id as string
        if (!stat[a]) stat[a] = { total: 0, last: o.created_at }
        stat[a].total++
        if (o.created_at > stat[a].last) stat[a].last = o.created_at
      }
      return {
        period_days: 30,
        teachers: (staffRes.data ?? []).map((u: Json) => ({
          name: u.full_name, role: u.role,
          observations: stat[u.id]?.total ?? 0,
          last_observation: stat[u.id]?.last?.slice(0, 10) ?? null,
        })).sort((a: Json, b: Json) => b.observations - a.observations),
      }
    }

    case 'get_latest_school_report': {
      const { data } = await ctx.supabase.from('school_ai_reports')
        .select('climate, at_risk_classes, trends, recommendations, month, generated_at')
        .eq('school_id', ctx.schoolId).order('month', { ascending: false }).limit(1).maybeSingle()
      if (!data) return { note: 'Ежемесячного отчёта пока нет.' }
      return data
    }

    default:
      return { error: `Неизвестный инструмент: ${name}` }
  }
}
