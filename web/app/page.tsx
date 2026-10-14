import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { DashboardContent } from '@/components/dashboard/DashboardContent'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('school_id, full_name, role, class_id, school:schools(school_year)')
    .eq('id', user.id)
    .single()

  const schoolId = profile?.school_id ?? ''
  const userName = profile?.full_name ?? ''
  const userRole = profile?.role ?? ''
  const schoolYear = (profile?.school as { school_year?: number } | null)?.school_year ?? 2026
  const canViewAnalytics = ['admin', 'deputy', 'manager'].includes(userRole)

  // Классный руководитель может вести несколько классов (classes.teacher_id)
  let classTeacherClassIds: string[] = []
  let classTeacherClassName: string | null = null
  if (userRole === 'class_teacher') {
    const { data: myClasses } = await supabase
      .from('classes').select('id, name').eq('teacher_id', user.id).order('name')
    classTeacherClassIds = (myClasses ?? []).map((c: any) => c.id)
    classTeacherClassName = (myClasses ?? []).map((c: any) => c.name).join(', ') || null
  }
  const scopedToClasses = classTeacherClassIds.length > 0

  // For class teacher: get student IDs in their classes to scope observations
  let classStudentIds: string[] | null = null
  if (scopedToClasses) {
    const { data: classStudents } = await supabase
      .from('students').select('id').in('class_id', classTeacherClassIds)
    classStudentIds = (classStudents ?? []).map((s: any) => s.id)
  }

  // All student IDs in scope — used to explicitly filter observations (avoids RLS join gaps)
  let obsStudentIds: string[] = classStudentIds ?? []
  if (!scopedToClasses && schoolId) {
    const { data: schoolStudents } = await supabase
      .from('students').select('id').eq('school_id', schoolId).eq('status', 'active')
    obsStudentIds = (schoolStudents ?? []).map((s: any) => s.id)
  }

  const studentFilter = scopedToClasses
    ? supabase.from('students').select('id', { count: 'exact', head: true }).in('class_id', classTeacherClassIds).eq('status', 'active')
    : supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active')

  const riskFilter = scopedToClasses
    ? supabase.from('students').select('id, full_name, risk_level, class:classes(name)').in('class_id', classTeacherClassIds).in('risk_level', ['high', 'medium']).limit(5)
    : supabase.from('students').select('id, full_name, risk_level, class:classes(name)').eq('school_id', schoolId).in('risk_level', ['high', 'medium']).limit(5)

  const obsSelect = 'id, author_id, student_id, content, category, created_at, is_alert, student:students(full_name, class_id, photo_url, class:classes(name)), author:users(full_name), reactions:observation_reactions(emoji, user_id, user:users(full_name))'

  const obsCountQuery = obsStudentIds.length > 0
    ? supabase.from('observations').select('id', { count: 'exact', head: true }).eq('source', 'manual').in('student_id', obsStudentIds)
    : supabase.from('observations').select('id', { count: 'exact', head: true }).eq('source', 'manual')

  // Alerts + full observations feed — both scoped via obsStudentIds
  const alertQuery = obsStudentIds.length > 0
    ? supabase.from('observations').select('id', { count: 'exact', head: true }).eq('source', 'manual').eq('is_alert', true).in('student_id', obsStudentIds)
    : supabase.from('observations').select('id', { count: 'exact', head: true }).eq('source', 'manual').eq('is_alert', true)

  const obsDataQuery = obsStudentIds.length > 0
    ? supabase.from('observations').select(obsSelect).eq('source', 'manual').in('student_id', obsStudentIds).order('created_at', { ascending: false })
    : supabase.from('observations').select(obsSelect).eq('source', 'manual').order('created_at', { ascending: false })

  const now = new Date()
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since7d  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()

  const makeObsQ = () => obsStudentIds.length > 0
    ? supabase.from('observations').select('id', { count: 'exact', head: true }).eq('source', 'manual').in('student_id', obsStudentIds)
    : supabase.from('observations').select('id', { count: 'exact', head: true }).eq('source', 'manual')

  // Один общий параллельный батч вместо пяти последовательных «волн»: все эти
  // запросы зависят лишь от schoolId / obsStudentIds, которые уже известны здесь.
  // Раньше это были 5 отдельных await-групп подряд → ~5 сетевых round-trip'ов к
  // Supabase на каждый переход. Теперь — один.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [
    studentsRes, observationsRes, riskRes, classesRes, noRecentObsRes,
    alertRes, obsDataRes,
    newStudentsRes, newObsRes, newAlertObsRes, departedRes,
    staffRes, staffObs30dRes,
    aiReportRes,
  ] = await Promise.all([
    studentFilter,
    obsCountQuery,
    riskFilter,
    supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
    schoolId ? supabase.rpc('get_students_no_recent_obs', { p_school_id: schoolId }) : Promise.resolve({ data: [] }),
    alertQuery,
    obsDataQuery,
    supabase.from('students').select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('status', 'active').gte('created_at', since30d),
    makeObsQ().gte('created_at', since7d),
    makeObsQ().eq('is_alert', true).gte('created_at', since7d),
    supabase.from('students').select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('status', 'departed').gte('created_at', since30d),
    supabase.from('users')
      .select('id, full_name, role').eq('school_id', schoolId)
      .in('role', ['deputy', 'class_teacher', 'teacher', 'psychologist', 'nurse', 'security']),
    supabase.from('observations')
      .select('author_id, created_at, students!inner(school_id)')
      .eq('source', 'manual').eq('students.school_id', schoolId).gte('created_at', since30d),
    (canViewAnalytics && schoolId)
      ? supabase.from('school_ai_reports').select('recommendations').eq('school_id', schoolId).order('month', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ]) as any[]

  const alertCount = alertRes.count ?? 0
  const recentObsData = obsDataRes.data ?? []
  const newStudentsMonth   = newStudentsRes.count ?? 0
  const newObsWeek         = newObsRes.count ?? 0
  const newAlertObsWeek    = newAlertObsRes.count ?? 0
  const departedMonth      = departedRes.count ?? 0

  // ── Активность педагогов за 30 дней (по всей школе, для всех сотрудников) ──
  const teacherObs30d: Record<string, { total: number; lastObs: string }> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const o of (staffObs30dRes.data ?? []) as any[]) {
    const a = o.author_id as string
    if (!teacherObs30d[a]) teacherObs30d[a] = { total: 0, lastObs: o.created_at }
    teacherObs30d[a].total++
    if (o.created_at > teacherObs30d[a].lastObs) teacherObs30d[a].lastObs = o.created_at
  }
  // role передаём ключом — перевод на клиенте (t('role.' + role))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teacherStats = ((staffRes.data ?? []) as any[]).map((u) => ({
    name: u.full_name as string,
    role: u.role as string,
    obsCount: teacherObs30d[u.id]?.total ?? 0,
    lastObs: teacherObs30d[u.id]?.lastObs ?? null,
  })).sort((a, b) => b.obsCount - a.obsCount)

  const stats = {
    students: studentsRes.count ?? 0,
    alerts: alertCount,
    observations: observationsRes.count ?? 0,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const riskStudents = (riskRes.data ?? []).map((s: any) => ({
    id: s.id as string,
    full_name: s.full_name as string,
    risk_level: s.risk_level as string,
    class: Array.isArray(s.class) ? s.class[0] ?? null : s.class ?? null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentObservations = (recentObsData ?? []).map((o: any) => {
    const student = Array.isArray(o.student) ? o.student[0] ?? null : o.student ?? null
    return {
      id: o.id as string,
      author_id: o.author_id as string,
      student_id: o.student_id as string,
      content: o.content as string,
      category: o.category as string,
      created_at: o.created_at as string,
      is_alert: o.is_alert as boolean,
      student: student ? {
        full_name: student.full_name,
        class_id: student.class_id as string | null,
        photo_url: student.photo_url as string | null ?? null,
        class: Array.isArray(student.class) ? student.class[0] ?? null : student.class ?? null,
      } : null,
      author: Array.isArray(o.author) ? o.author[0] ?? null : o.author ?? null,
      reactions: (o.reactions ?? []).map((r: any) => ({
        emoji: r.emoji,
        user_id: r.user_id,
        user: Array.isArray(r.user) ? r.user[0] ?? null : r.user ?? null,
      })),
    }
  })

  const classes = (classesRes.data ?? []) as { id: string; name: string }[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let noRecentObs = ((noRecentObsRes as any).data ?? []).map((r: any) => ({
    id: r.id as string,
    full_name: r.full_name as string,
    class_name: r.class_name as string,
    days_since: r.days_since as number | null,
  }))
  // Scope to class teacher's students if needed
  if (classStudentIds !== null && classStudentIds.length > 0) {
    noRecentObs = noRecentObs.filter((r: { id: string }) => classStudentIds!.includes(r.id))
  }

  // AI school report — уже получен в общем батче выше (только для admin/deputy/manager)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiRecommendations: string | null = (aiReportRes as any)?.data?.recommendations ?? null

  return (
    <DashboardShell>
      <DashboardContent
        stats={stats}
        riskStudents={riskStudents}
        recentObservations={recentObservations}
        userName={userName}
        classes={classes}
        schoolYear={schoolYear}
        isAdmin={['admin', 'manager'].includes(userRole)}
        canViewAllObs={['admin', 'deputy'].includes(userRole)}
        canViewAnalytics={canViewAnalytics}
        classTeacherClassName={classTeacherClassName}
        currentUserId={user!.id}
        defaultClassId=""
        noRecentObs={noRecentObs}
        newStudentsMonth={newStudentsMonth}
        departedMonth={departedMonth}
        newObsWeek={newObsWeek}
        newAlertObsWeek={newAlertObsWeek}
        aiRecommendations={aiRecommendations}
        teacherStats={teacherStats}
      />
    </DashboardShell>
  )
}
