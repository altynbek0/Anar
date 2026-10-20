import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

// День по времени Бишкека (UTC+6): ночные наблюдения не должны попадать в «вчера»
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bishkek' }).format(d)

export default async function AnalyticsPage() {
  await requireRole(['admin', 'deputy', 'manager'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users').select('school_id, school:schools(school_year)').eq('id', user!.id).single()

  const schoolId = profile?.school_id ?? ''
  const schoolYear = (profile?.school as { school_year?: number } | null)?.school_year ?? new Date().getFullYear()
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const REASON_COLORS: Record<string, string> = {
    'Переезд семьи': '#3B82F6', 'Другая школа': '#8B5CF6',
    'Недовольство': '#EF4444', 'Финансы': '#F59E0B',
    'Колледж': '#10B981', 'Другое': '#6B7280',
  }

  // ── Batch 1: всё, что зависит только от schoolId (структура + цели + AI-отчёт) ──
  const [studentsRes, departedRes, classesRes, noRecentObsRes, parentGoalRes, aiReportRes] = await Promise.all([
    supabase.from('students')
      .select('id, full_name, risk_level, class_id, class:classes(name)')
      .eq('school_id', schoolId).eq('status', 'active'),
    supabase.from('students')
      .select('id, departure_reason').eq('school_id', schoolId).eq('status', 'departed'),
    supabase.from('classes')
      .select('id, name').eq('school_id', schoolId),
    schoolId
      ? supabase.rpc('get_students_no_recent_obs', { p_school_id: schoolId })
      : Promise.resolve({ data: [] }),
    supabase.from('students')
      .select('parent_goal')
      .eq('school_id', schoolId).eq('status', 'active')
      .not('parent_goal', 'is', null).neq('parent_goal', ''),
    supabase.from('school_ai_reports')
      .select('climate, at_risk_classes, trends, recommendations, month, generated_at')
      .eq('school_id', schoolId).order('month', { ascending: false }).limit(1).maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = (studentsRes.data ?? []) as any[]
  const totalStudents = students.length

  // "В зоне риска" = студенты без наблюдений 14+ дней (алгоритмическое правило)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noRecentObsData = ((noRecentObsRes as any).data ?? []) as { id: string; full_name: string; class_name: string; days_since: number | null }[]
  const noRecentIds = new Set(noRecentObsData.map((r) => r.id))
  const riskCount = noRecentObsData.length

  // ── Batch 2: observation data (only active students) ──────────────────────
  // Join по ученикам школы вместо .in(studentIds): список из сотен uuid ломает адрес запроса
  const activeObs = () => supabase.from('observations')
    .select('id, student:students!inner(school_id, status)', { count: 'exact', head: true })
    .eq('source', 'manual').eq('student.school_id', schoolId).eq('student.status', 'active')
  const [obsCountRes, alertCountRes, obs30dRows] = await Promise.all([
    activeObs(),
    activeObs().eq('is_alert', true),
    // постранично: ответ PostgREST обрезается на 1000 строк
    fetchAllRows<{ created_at: string; is_alert: boolean; category: string; author_id: string; student_id: string }>((from, to) =>
      supabase.from('observations')
        .select('created_at, is_alert, category, author_id, student_id, student:students!inner(school_id, status)')
        .eq('source', 'manual').eq('student.school_id', schoolId).eq('student.status', 'active')
        .gte('created_at', since30d).order('id').range(from, to),
    ),
  ])

  const totalObservations = obsCountRes.count ?? 0
  const alertObservations = alertCountRes.count ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obs30d = obs30dRows as any[]

  // ── Departure reasons ──────────────────────────────────────────────────────
  const reasonCounts: Record<string, number> = {}
  for (const s of departedRes.data ?? []) {
    if (s.departure_reason === 'Выпуск') continue
    const r = s.departure_reason ?? 'Другое'
    const key = Object.keys(REASON_COLORS).includes(r) ? r : 'Другое'
    reasonCounts[key] = (reasonCounts[key] ?? 0) + 1
  }
  const departureReasons = Object.entries(reasonCounts).map(([name, value]) => ({
    name, value, color: REASON_COLORS[name] ?? '#6B7280',
  }))
  const departedTotal = (departedRes.data ?? []).filter((s) => s.departure_reason !== 'Выпуск').length

  // ── Trend data (30 days by day) ────────────────────────────────────────────
  const trendMap: Record<string, { label: string; total: number; alerts: number }> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = dayKey(d)
    const label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Asia/Bishkek' }).replace('.', '')
    trendMap[key] = { label, total: 0, alerts: 0 }
  }
  for (const obs of obs30d) {
    const key = dayKey(new Date(obs.created_at as string))
    if (trendMap[key]) {
      trendMap[key].total++
      if (obs.is_alert) trendMap[key].alerts++
    }
  }
  const trendData = Object.values(trendMap)

  // ── Per-student obs map (30d) ──────────────────────────────────────────────
  const studentObs30d: Record<string, { total: number; alerts: number }> = {}
  for (const obs of obs30d) {
    if (!studentObs30d[obs.student_id]) studentObs30d[obs.student_id] = { total: 0, alerts: 0 }
    studentObs30d[obs.student_id].total++
    if (obs.is_alert) studentObs30d[obs.student_id].alerts++
  }

  // ── Class stats ────────────────────────────────────────────────────────────
  const classNameMap: Record<string, string> = {}
  for (const cls of classesRes.data ?? []) classNameMap[cls.id] = cls.name

  const classGroups: Record<string, typeof students> = {}
  for (const s of students) {
    if (!s.class_id) continue
    if (!classGroups[s.class_id]) classGroups[s.class_id] = []
    classGroups[s.class_id].push(s)
  }
  const classStats = Object.entries(classGroups).map(([classId, clsStudents]) => ({
    name: classNameMap[classId] ?? classId,
    studentCount: clsStudents.length,
    obsCount: clsStudents.reduce((sum, s) => sum + (studentObs30d[s.id]?.total ?? 0), 0),
    alertCount: clsStudents.reduce((sum, s) => sum + (studentObs30d[s.id]?.alerts ?? 0), 0),
    riskCount: clsStudents.filter((s) => s.risk_level !== 'none').length,
    noObsCount: clsStudents.filter((s) => noRecentIds.has(s.id)).length,
  })).sort((a, b) => {
    const parse = (n: string) => { const m = n.match(/^(\d+)(.*)$/); return m ? [parseInt(m[1]), m[2].trim()] as [number, string] : [0, n] as [number, string] }
    const [ag, al] = parse(a.name); const [bg, bl] = parse(b.name)
    return ag !== bg ? bg - ag : al.localeCompare(bl)
  })

  // ── Parent goals (данные уже в Batch 1) ────────────────────────────────────
  const parentGoalRows = parentGoalRes.data ?? []
  const goalCounts: Record<string, number> = {}
  for (const row of parentGoalRows ?? []) {
    const raw = (row.parent_goal as string | null)?.trim() ?? ''
    if (!raw) continue
    for (const part of raw.split(/[,;\/\n]+/)) {
      const g = part.trim()
      if (g.length < 2) continue
      const key = g.charAt(0).toUpperCase() + g.slice(1).toLowerCase()
      goalCounts[key] = (goalCounts[key] ?? 0) + 1
    }
  }
  const parentGoals = Object.entries(goalCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)

  // ── AI school report (данные уже в Batch 1) ──────────────────────────────
  const aiReport = aiReportRes.data ?? null

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Аналитика школы</h1>
        <p className="text-sm text-gray-400 mt-0.5">Дашборд для администрации</p>
      </div>

      <AnalyticsClient
        totalStudents={totalStudents}
        riskCount={riskCount}
        totalObservations={totalObservations}
        alertObservations={alertObservations}
        departureReasons={departureReasons}
        departedTotal={departedTotal}
        schoolYear={schoolYear}
        trendData={trendData}
        classStats={classStats}
        aiReport={aiReport ?? null}
        parentGoals={parentGoals}
      />
    </div>
  )
}
