'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, GraduationCap, Pencil, Search, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteStudent, deleteClass, graduateClass, updateClass } from '@/app/(dashboard)/students/actions'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Student {
  id: string
  full_name: string
  risk_level: string
  status: string
  class_id: string
  photo_url?: string | null
  obs_count: number
  alert_count: number
}

interface ClassGroup {
  id: string
  name: string
  grade: number
  letter: string
  students: Student[]
}

const CLASS_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-green-500', 'bg-red-500',
]

// value — каноничное значение (хранится в БД, используется в аналитике); key — перевод подписи
const DEPARTURE_REASONS: { value: string; key: string }[] = [
  { value: 'Переезд семьи', key: 'depart.move' },
  { value: 'Другая школа', key: 'depart.otherSchool' },
  { value: 'Недовольство', key: 'depart.dissatisfaction' },
  { value: 'Финансы', key: 'depart.finance' },
  { value: 'Колледж', key: 'depart.college' },
  { value: 'Другое', key: 'depart.other' },
]

interface DeleteModal {
  studentId: string
  name: string
  grade: number
}

export function StudentsListClient({ classList, canDelete = false, noRecentObsIds = [] }: { classList: ClassGroup[]; canDelete?: boolean; noRecentObsIds?: string[] }) {
  const { t } = useI18n()
  const router = useRouter()
  const atRiskSet = new Set(noRecentObsIds)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [classes, setClasses] = useState<ClassGroup[]>(classList)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [deleteModal, setDeleteModal] = useState<DeleteModal | null>(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [otherText, setOtherText] = useState('')
  const [showMinus, setShowMinus] = useState(false)

  const [editModal, setEditModal] = useState<{ classId: string; name: string } | null>(null)
  const [editGrade, setEditGrade] = useState('')
  const [editLetter, setEditLetter] = useState('')

  function openEditModal(cls: ClassGroup) {
    setEditModal({ classId: cls.id, name: cls.name })
    setEditGrade(cls.grade ? String(cls.grade) : '')
    setEditLetter(cls.letter ?? '')
  }

  async function confirmEdit() {
    if (!editModal) return
    const g = parseInt(editGrade)
    const l = editLetter.trim()
    if (!g || !l) return
    setLoadingId(editModal.classId)
    setError(null)
    const res = await updateClass(editModal.classId, g, l)
    if (res.error) {
      setError(res.error)
    } else {
      setClasses((prev) => prev.map((c) => c.id === editModal.classId ? { ...c, name: `${g}${l}`, grade: g, letter: l } : c))
      setEditModal(null)
    }
    setLoadingId(null)
  }

  const totalCount = classes.reduce((sum, cls) => sum + cls.students.length, 0)

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openDeleteModal(studentId: string, name: string, grade: number) {
    setDeleteModal({ studentId, name, grade })
    setSelectedReason('')
    setOtherText('')
  }

  function closeDeleteModal() {
    setDeleteModal(null)
    setSelectedReason('')
    setOtherText('')
  }

  async function confirmDelete() {
    if (!deleteModal) return
    const reason = selectedReason === 'Другое' ? (otherText.trim() || 'Другое') : selectedReason
    if (!reason) return

    setLoadingId(deleteModal.studentId)
    setError(null)
    const res = await deleteStudent(deleteModal.studentId, reason)
    if (res.error) {
      setError(res.error)
    } else {
      setClasses((prev) => prev.map((cls) => ({
        ...cls,
        students: cls.students.filter((s) => s.id !== deleteModal.studentId),
      })))
      setShowMinus(true)
      setTimeout(() => setShowMinus(false), 2500)
    }
    setLoadingId(null)
    closeDeleteModal()
  }

  async function handleGraduateClass(classId: string, name: string) {
    if (!confirm(t('stud.confirmGraduate', { name }))) return
    setLoadingId(classId)
    setError(null)
    const res = await graduateClass(classId)
    if (res.error) { setError(res.error) } else {
      setClasses((prev) => prev.filter((cls) => cls.id !== classId))
    }
    setLoadingId(null)
  }

  async function handleDeleteClass(classId: string, name: string, count: number) {
    if (!confirm(t('stud.confirmDeleteClass', { name, count }))) return
    setLoadingId(classId)
    setError(null)
    const res = await deleteClass(classId)
    if (res.error) { setError(res.error) } else {
      setClasses((prev) => prev.filter((cls) => cls.id !== classId))
    }
    setLoadingId(null)
  }

  const filtered = classes.map((cls) => ({
    ...cls,
    students: cls.students.filter((s) => s.full_name.toLowerCase().includes(search.toLowerCase())),
  })).filter((cls) => search === '' || cls.students.length > 0)

  const canConfirm = selectedReason !== '' && (selectedReason !== 'Другое' || otherText.trim() !== '')

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 flex flex-col justify-center">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-gray-900">{totalCount}</span>
              <span className="text-sm text-gray-400">{t('stud.studentsWord')}</span>
            </div>
            {showMinus && (
              <span className="text-xs font-semibold text-red-500 mt-0.5">{t('stud.deleted1')}</span>
            )}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('stud.searchStudent')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl">{error}</div>
        )}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">{t('stud.notFound')}</div>
        )}

        {filtered.map((cls, idx) => {
          const isOpen = expanded.has(cls.id)
          const colorClass = CLASS_COLORS[idx % CLASS_COLORS.length]

          const riskCount   = cls.students.filter((s) => atRiskSet.has(s.id)).length
          const totalObs    = cls.students.reduce((sum, s) => sum + s.obs_count, 0)
          const totalAlerts = cls.students.reduce((sum, s) => sum + s.alert_count, 0)

          return (
            <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <tbody>
                  {/* ── Class header row ── */}
                  <tr className="group/cls cursor-pointer hover:bg-gray-50/60 active:bg-gray-50 transition-colors" onClick={() => toggle(cls.id)}>
                    <td className="px-4 py-3.5 sm:px-5 sm:py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0', colorClass)}>
                          {cls.name}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900">{cls.name} {t('stud.classWord')}</span>
                          <span className="text-xs text-gray-400 ml-2">{cls.students.length} {t('stud.studentsAbbr')}</span>
                          {/* Mobile: inline stats */}
                          <div className="flex items-center gap-1.5 mt-0.5 sm:hidden">
                            {riskCount > 0 && <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{riskCount} {t('stud.riskShort')}</span>}
                            {totalAlerts > 0 && <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">{totalAlerts} {t('stud.alertsAbbr')}</span>}
                          </div>
                        </div>
                        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      </div>
                    </td>
                    {/* Desktop-only stat columns */}
                    <td className="hidden sm:table-cell px-6 py-4">
                      <div className="text-[10px] font-medium text-gray-400 mb-1">{t('stud.atRiskCol')}</div>
                      {riskCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />{riskCount}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 text-center">
                      <div className="text-[10px] font-medium text-gray-400 mb-1">{t('stud.observations')}</div>
                      <span className={cn('text-sm font-semibold', totalObs === 0 ? 'text-gray-200' : 'text-gray-700')}>{totalObs}</span>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 text-right">
                      <div className="text-[10px] font-medium text-gray-400 mb-1">{t('stud.alerts')}</div>
                      {totalAlerts > 0 ? <span className="text-sm font-semibold text-red-500">{totalAlerts}</span> : <span className="text-xs text-gray-200">—</span>}
                    </td>
                    <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {canDelete && (
                        <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover/cls:opacity-100">
                          <button onClick={() => openEditModal(cls)} disabled={loadingId === cls.id} title={t('stud.editClass')} className="p-1.5 text-gray-400 hover:text-blue-500 active:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {(cls.grade === 11 || cls.grade === 12) && (
                            <button onClick={() => handleGraduateClass(cls.id, cls.name)} disabled={loadingId === cls.id} title={t('stud.graduateClass')} className="p-1.5 text-gray-400 hover:text-yellow-500 active:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-all">
                              <GraduationCap className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteClass(cls.id, cls.name, cls.students.length)} disabled={loadingId === cls.id} title={t('stud.deleteClass')} className="p-1.5 text-gray-400 hover:text-red-500 active:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* ── Column headers (desktop) ── */}
                  {isOpen && cls.students.length > 0 && (
                    <tr className="bg-gray-50/70 border-t border-gray-100">
                      <th className="text-left text-[11px] font-medium text-gray-400 px-4 py-2 sm:px-5">{t('stud.student')}</th>
                      <th className="hidden sm:table-cell text-left text-[11px] font-medium text-gray-400 px-6 py-2">{t('stud.status')}</th>
                      <th className="hidden sm:table-cell text-center text-[11px] font-medium text-gray-400 px-6 py-2">{t('stud.observations')}</th>
                      <th className="hidden sm:table-cell text-right text-[11px] font-medium text-gray-400 px-6 py-2">{t('stud.alerts')}</th>
                      <th className="px-4 py-2 sm:px-5"></th>
                    </tr>
                  )}

                  {/* ── Student rows ── */}
                  {isOpen && cls.students.map((student) => {
                    const initials = student.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                    const isAtRisk = atRiskSet.has(student.id)
                    return (
                      <tr key={student.id} className="border-t border-gray-50 hover:bg-gray-50/50 active:bg-gray-50 group/row cursor-pointer" onClick={() => router.push(`/students/${student.id}`)}>
                        <td className="px-4 py-3 sm:px-5">
                          <div className="flex items-center gap-3">
                            <div className={cn('w-8 h-8 rounded-full flex-shrink-0 overflow-hidden', !student.photo_url && (isAtRisk ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'), !student.photo_url && 'flex items-center justify-center text-xs font-semibold')}>
                              {student.photo_url ? <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" /> : initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-900 group-hover/row:text-blue-600 transition-colors truncate block">{student.full_name}</span>
                              {/* Mobile: status inline */}
                              <div className="sm:hidden mt-0.5">
                                {isAtRisk ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                                    <span className="w-1 h-1 rounded-full bg-red-500 inline-block" />{t('stud.risk')}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                                    <span className="w-1 h-1 rounded-full bg-green-400 inline-block" />{t('stud.normal')}
                                  </span>
                                )}
                                {student.obs_count > 0 && <span className="text-[10px] text-gray-400 ml-1.5">{student.obs_count} {t('stud.obsAbbr')}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-3">
                          {isAtRisk ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />{t('stud.atRiskCol')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />{t('stud.normal')}
                            </span>
                          )}
                        </td>
                        <td className="hidden sm:table-cell px-6 py-3 text-center">
                          <span className={cn('text-xs font-medium', student.obs_count === 0 ? 'text-gray-300' : 'text-gray-600')}>{student.obs_count}</span>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-3 text-right">
                          {student.alert_count > 0 ? <span className="text-xs font-medium text-red-500">{student.alert_count}</span> : <span className="text-xs text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-3 sm:px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          {student.alert_count > 0 && <span className="sm:hidden text-xs font-semibold text-red-500 mr-1">⚠{student.alert_count}</span>}
                          {canDelete && (
                            <button onClick={() => openDeleteModal(student.id, student.full_name, cls.grade)} disabled={loadingId === student.id} title={t('stud.deleteStudent')} className="p-1.5 text-gray-400 hover:text-red-500 active:text-red-500 hover:bg-red-50 rounded-lg transition-all sm:opacity-0 sm:group-hover/row:opacity-100">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {isOpen && cls.students.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-sm text-gray-400 py-6 border-t border-gray-50">{t('stud.noStudents')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      {/* ── Departure reason modal ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDeleteModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <button
              onClick={closeDeleteModal}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-base font-semibold text-gray-900 mb-1">{t('stud.departTitle')}</h2>
            <p className="text-sm text-gray-500 mb-5">{t('stud.departDesc', { name: deleteModal.name })}</p>

            <div className="space-y-2.5 mb-5">
              {DEPARTURE_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all',
                    selectedReason === reason.value
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <input
                    type="radio"
                    name="departure_reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={() => setSelectedReason(reason.value)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">{t(reason.key)}</span>
                </label>
              ))}

              {selectedReason === 'Другое' && (
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder={t('stud.describeReason')}
                  rows={3}
                  className="w-full mt-1 px-4 py-3 text-sm rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none"
                  autoFocus
                />
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={closeDeleteModal}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                disabled={!canConfirm || loadingId === deleteModal.studentId}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {loadingId === deleteModal.studentId ? t('stud.deleting') : t('stud.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit class modal ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <button onClick={() => setEditModal(null)} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-gray-900 mb-4">{t('stud.editClass')}</h2>
            <div className="flex gap-2 mb-2">
              <select
                value={editGrade}
                onChange={(e) => setEditGrade(e.target.value)}
                className="w-28 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 bg-white"
              >
                <option value="">{t('stud.grade')}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <input
                value={editLetter}
                onChange={(e) => setEditLetter(e.target.value)}
                placeholder={t('stud.letterPlaceholder')}
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-400 mb-5">{t('stud.editHint')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmEdit}
                disabled={!editGrade || !editLetter.trim() || loadingId === editModal.classId}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {loadingId === editModal.classId ? t('stud.saving') : t('stud.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
