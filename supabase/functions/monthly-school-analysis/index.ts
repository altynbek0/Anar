import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const CATEGORY_LABELS: Record<string, string> = {
  academic: 'Академическое', behavior: 'Поведение', psychology: 'Психология',
  sport: 'Спорт', creative: 'Творчество', health: 'Здоровье', social: 'Социальное',
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  // Fail-closed: без настроенного CRON_SECRET функция недоступна.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret)
    return new Response('Unauthorized', { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const now = new Date()

    let firstOfTargetMonth: Date
    let firstOfNextMonth: Date

    if (body.month) {
      const [y, m] = (body.month as string).split('-').map(Number)
      firstOfTargetMonth = new Date(Date.UTC(y, m - 1, 1))
      firstOfNextMonth   = new Date(Date.UTC(y, m, 1))
    } else {
      firstOfTargetMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      firstOfNextMonth   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    }

    const monthLabel = firstOfTargetMonth.toISOString().slice(0, 10)
    console.log(`Processing month: ${monthLabel}`)

    const { data: schools, error: schoolsErr } = await supabase.from('schools').select('id, name')
    if (schoolsErr) throw schoolsErr
    if (!schools || schools.length === 0)
      return new Response(JSON.stringify({ message: 'No schools found' }), { status: 200 })

    const errors: string[] = []
    let processed = 0

    for (const school of schools) {
      try {
        const schoolId = school.id

        const { data: studentRows } = await supabase
          .from('students').select('id').eq('school_id', schoolId).eq('status', 'active')
        const ids = (studentRows ?? []).map(s => s.id)
        if (ids.length === 0) continue

        const { data: allObs } = await supabase
          .from('observations')
          .select('category, is_alert, content, student_id')
          .eq('source', 'manual')
          .gte('created_at', firstOfTargetMonth.toISOString())
          .lt('created_at', firstOfNextMonth.toISOString())
          .in('student_id', ids)

        if (!allObs || allObs.length === 0) continue

        const catCounts: Record<string, number> = {}
        let totalAlerts = 0
        for (const o of allObs) {
          catCounts[o.category] = (catCounts[o.category] ?? 0) + 1
          if (o.is_alert) totalAlerts++
        }
        const catSummary = Object.entries(catCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${CATEGORY_LABELS[k] ?? k}: ${v}`)
          .join(', ')

        const { data: alertObs } = await supabase
          .from('observations')
          .select('content, category, students!inner(full_name, class_id, school_id, classes(name))')
          .eq('source', 'manual')
          .eq('is_alert', true)
          .gte('created_at', firstOfTargetMonth.toISOString())
          .lt('created_at', firstOfNextMonth.toISOString())
          .eq('students.school_id', schoolId)
          .limit(30)

        const alertText = (alertObs ?? []).map(o => {
          const s = o.students as { full_name: string; classes: { name: string } | null }
          const cls = s.classes?.name ?? '—'
          return `[${cls}] ${s.full_name}: ${o.content}`
        }).join('\n')

        const { data: classStats } = await supabase
          .from('observations')
          .select('is_alert, students!inner(class_id, school_id, classes!inner(name))')
          .eq('source', 'manual')
          .eq('students.school_id', schoolId)
          .gte('created_at', firstOfTargetMonth.toISOString())
          .lt('created_at', firstOfNextMonth.toISOString())

        const classCounts: Record<string, { total: number; alerts: number }> = {}
        for (const o of classStats ?? []) {
          const s = o.students as { classes: { name: string } | null }
          const name = s.classes?.name ?? 'Без класса'
          if (!classCounts[name]) classCounts[name] = { total: 0, alerts: 0 }
          classCounts[name].total++
          if (o.is_alert) classCounts[name].alerts++
        }
        const classBreakdown = Object.entries(classCounts)
          .sort((a, b) => b[1].alerts - a[1].alerts)
          .map(([name, s]) => `${name}: ${s.total} наблюдений, ${s.alerts} тревожных`)
          .join('\n')

        const prevMonthDate = new Date(Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() - 1, 1))
        const { data: prevReport } = await supabase
          .from('school_ai_reports')
          .select('climate, at_risk_classes, trends, recommendations')
          .eq('school_id', schoolId)
          .eq('month', prevMonthDate.toISOString().slice(0, 10))
          .single()

        const prevText = prevReport
          ? `Климат: ${prevReport.climate}\nКлассы: ${prevReport.at_risk_classes}\nТренды: ${prevReport.trends}\nРекомендации: ${prevReport.recommendations}`
          : 'Предыдущего отчёта нет.'

        const { count: highRiskCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('status', 'active')
          .eq('risk_level', 'high')

        const monthName = firstOfTargetMonth.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })
        const prompt = `Ты опытный школьный психолог и аналитик. Проанализируй данные школы за ${monthName} и составь ежемесячный отчёт для директора. Пиши на русском, профессионально но понятно.
Правила по разделам:
- climate: 3-4 предложения
- at_risk_classes: 3-4 предложения
- trends: 3-4 предложения
- recommendations: СТРОГО максимум 2 предложения, конкретные действия

Школа: ${school.name}

СТАТИСТИКА ЗА МЕСЯЦ:
- Всего наблюдений: ${allObs.length}
- По категориям: ${catSummary}
- Тревожных сигналов: ${totalAlerts}
- Учеников с высоким риском: ${highRiskCount ?? 0}

РАЗБИВКА ПО КЛАССАМ:
${classBreakdown || 'Нет данных'}

ТРЕВОЖНЫЕ НАБЛЮДЕНИЯ:
${alertText || 'Тревожных наблюдений не было'}

АНАЛИЗ ПРОШЛОГО МЕСЯЦА:
${prevText}

Ответь JSON без markdown:
{
  "climate": "...",
  "at_risk_classes": "...",
  "trends": "...",
  "recommendations": "..."
}`

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        })

        const text = (response.content[0] as { type: string; text: string }).text.trim()
        const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '')
        const result = JSON.parse(json)

        const { error: upsertErr } = await supabase.from('school_ai_reports').upsert(
          {
            school_id: schoolId,
            month: monthLabel,
            climate: result.climate,
            at_risk_classes: result.at_risk_classes,
            trends: result.trends,
            recommendations: result.recommendations,
            generated_at: new Date().toISOString(),
          },
          { onConflict: 'school_id,month' }
        )
        if (upsertErr) throw new Error(`Upsert error: ${upsertErr.message}`)

        processed++
      } catch (schoolErr) {
        console.error(`Error for school ${school.name}:`, schoolErr)
        errors.push(`${school.name}: ${String(schoolErr)}`)
      }
    }

    return new Response(JSON.stringify({ message: `Processed ${processed} schools for ${monthLabel}`, errors }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
