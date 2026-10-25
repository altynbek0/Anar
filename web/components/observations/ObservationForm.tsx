'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Brain, Activity, Palette, Heart, GraduationCap, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/I18nProvider'

const CATEGORIES = [
  { id: 'academic', icon: GraduationCap, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'behavior', icon: Activity, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  { id: 'psychology', icon: Brain, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'sport', icon: Activity, color: 'text-green-600 bg-green-50 border-green-200' },
  { id: 'creative', icon: Palette, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'health', icon: Heart, color: 'text-red-600 bg-red-50 border-red-200' },
  { id: 'social', icon: Users, color: 'text-teal-600 bg-teal-50 border-teal-200' },
] as const

interface Student { id: string; full_name: string; class_name: string; class_id: string | null }
interface ClassItem { id: string; name: string }

export function ObservationForm({ students, classes, authorId, defaultStudentId }: {
  students: Student[]; classes: ClassItem[]; authorId: string; defaultStudentId?: string
}) {
  const router = useRouter()
  const { t } = useI18n()
  const defaultStudent = defaultStudentId ? students.find(s => s.id === defaultStudentId) : null
  const [classId, setClassId] = useState(defaultStudent?.class_id ?? '')
  const [studentId, setStudentId] = useState(defaultStudentId ?? '')
  const [category, setCategory] = useState('')
  const [content, setContent] = useState('')
  const [isAlert, setIsAlert] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const filteredStudents = classId
    ? students.filter(s => s.class_id === classId)
    : students

  const canSave = studentId && category && content.length >= 10

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.from('observations').insert({
      student_id: studentId,
      author_id: authorId,
      category,
      content,
      is_alert: isAlert,
    })

    if (err) {
      setError(t('obs.error'))
      setSaving(false)
      return
    }

    setSuccess(true)
    setStudentId('')
    setClassId('')
    setCategory('')
    setContent('')
    setIsAlert(false)
    setSaving(false)
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Class select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('obs.class')}</label>
        <select
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setStudentId('') }}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white"
        >
          <option value="">{t('obs.allClasses')}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Student select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('obs.student')}</label>
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white"
          required
        >
          <option value="">{t('obs.studentPlaceholder')}</option>
          {filteredStudents.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('obs.category')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORIES.map(({ id, icon: Icon, color }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={cn(
                'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium',
                category === id ? color : 'border-gray-200 text-gray-500 hover:border-gray-300'
              )}
            >
              <Icon className="w-5 h-5" />
              {t('cat.' + id)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('obs.note')}</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder={t('obs.notePlaceholder')}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">{t('obs.minChars')}</span>
          <span className="text-xs text-gray-400">{t('obs.charsCount', { n: content.length })}</span>
        </div>
      </div>

      {/* Alert toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setIsAlert(!isAlert)}
          className={cn(
            'w-10 h-5 rounded-full transition-colors relative',
            isAlert ? 'bg-red-500' : 'bg-gray-200'
          )}
        >
          <div className={cn('w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm', isAlert ? 'translate-x-5' : 'translate-x-0.5')} />
        </div>
        <span className="text-sm text-gray-700">{t('obs.alert')}</span>
      </label>

      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          <svg className="w-5 h-5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('obs.success')}
        </div>
      )}

      {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}

      <button
        type="submit"
        disabled={!canSave || saving}
        className="w-full py-3 bg-[#C93252] text-white rounded-xl text-sm font-medium hover:bg-[#A92842] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? t('obs.saving') : t('obs.save')}
      </button>

      {/* Tips */}
      <div className="bg-blue-50 rounded-xl p-4">
        <p className="text-xs font-medium text-blue-700 mb-1.5">
          <BookOpen className="w-3.5 h-3.5 inline mr-1" />
          {t('obs.tipsTitle')}
        </p>
        <ul className="space-y-1">
          {['obs.tip1', 'obs.tip2', 'obs.tip3'].map((key) => (
            <li key={key} className="text-xs text-blue-600 flex gap-1.5">
              <span>•</span>{t(key)}
            </li>
          ))}
        </ul>
      </div>
    </form>
  )
}
