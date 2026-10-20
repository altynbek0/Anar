import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Phone, User } from 'lucide-react'
import { StudentTabs } from '@/components/students/StudentTabs'
import { StudentEditModal } from '@/components/students/StudentEditModal'

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Batch 1: student + auth + queries that only need student id
  const [{ data: student }, { data: { user } }, { data: observations }, { data: aiInsight }] = await Promise.all([
    supabase.from('students')
      .select('id, school_id, class_id, full_name, photo_url, parent_name, parent_phone, risk_level, status, goals, created_at, family_situation, health_status, dream, parent_goal, enrollment_year, class:classes(name)')
      .eq('id', id).single(),
    supabase.auth.getUser(),
    supabase.from('observations')
      .select('*, author:users(full_name), reactions:observation_reactions(emoji, user_id, user:users(full_name))')
      .eq('student_id', id).eq('source', 'manual')
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('ai_insights')
      .select('overview, interests, academic, extracurricular, achievements, psychology, generated_at')
      .eq('student_id', id).single(),
  ])

  if (!student) notFound()

  // История версий ИИ-сводок (для просмотра прошлых сводок по разделам)
  const { data: versions } = await supabase
    .from('ai_insight_versions')
    .select('section, content, created_at')
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  // Batch 2: queries that need student.school_id / student.class_id / user.id
  const [{ data: classes }, classTeacherRes, { data: currentUser }] = await Promise.all([
    supabase.from('classes').select('id, name').eq('school_id', student.school_id).order('name'),
    student.class_id
      ? supabase.from('classes').select('teacher:users!teacher_id(full_name)').eq('id', student.class_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('users').select('role').eq('id', user!.id).single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ct = (classTeacherRes.data as any)?.teacher
  const classTeacher = (Array.isArray(ct) ? ct[0] : ct) ?? null
  const canEdit = ['admin', 'deputy', 'manager', 'class_teacher'].includes(currentUser?.role ?? '')

  const aiSummaries = {
    overview:     aiInsight?.overview        ? { content: aiInsight.overview,          updated_at: aiInsight.generated_at } : undefined,
    interests:    aiInsight?.interests       ? { content: aiInsight.interests,         updated_at: aiInsight.generated_at } : undefined,
    performance:  aiInsight?.academic        ? { content: aiInsight.academic,          updated_at: aiInsight.generated_at } : undefined,
    activity:     aiInsight?.extracurricular ? { content: aiInsight.extracurricular,   updated_at: aiInsight.generated_at } : undefined,
    achievements: aiInsight?.achievements   ? { content: aiInsight.achievements,      updated_at: aiInsight.generated_at } : undefined,
    psychology:   aiInsight?.psychology     ? { content: aiInsight.psychology,        updated_at: aiInsight.generated_at } : undefined,
  }

  const initials = student.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
  const className = (student.class as { name?: string } | null)?.name ?? '—'

  return (
    <div className="p-4 sm:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
        <Link href="/students" className="hover:text-gray-600">Ученики</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-700 font-medium">{student.full_name}</span>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-start gap-4 sm:gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 overflow-hidden">
            {student.photo_url
              ? <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
              : initials
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-gray-900">{student.full_name}</h1>
                  {student.status === 'active'
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Активен</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Выбыл</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    student.risk_level === 'high' ? 'bg-red-100 text-red-700' :
                    student.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {student.risk_level === 'high' ? 'Высокий риск' : student.risk_level === 'medium' ? 'Средний риск' : 'Норма'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {className} класс
                  {classTeacher?.full_name && (
                    <span className="text-gray-400"> · Кл. рук.: {classTeacher.full_name}</span>
                  )}
                </p>
              </div>
              {canEdit && (
                <StudentEditModal
                  student={{
                    id: student.id,
                    full_name: student.full_name,
                    parent_name: student.parent_name,
                    parent_phone: student.parent_phone,
                    photo_url: student.photo_url,
                    class_id: student.class_id,
                    goals: student.goals,
                    dream: student.dream,
                    parent_goal: student.parent_goal,
                    family_situation: student.family_situation,
                    health_status: student.health_status,
                    enrollment_year: student.enrollment_year,
                  }}
                  classes={classes ?? []}
                />
              )}
            </div>

            {/* Parent contacts */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-5 gap-y-1.5">
              <p className="w-full text-xs text-gray-400">Контакты родителей</p>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span>{student.parent_name || '—'}</span>
              </div>
              {student.parent_phone ? (
                <a href={`tel:${student.parent_phone}`} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span>{student.parent_phone}</span>
                </a>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span>—</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <StudentTabs
        student={student}
        observations={observations ?? []}
        aiSummaries={aiSummaries}
        versions={versions ?? []}
        currentUserId={user!.id}
      />
    </div>
  )
}
