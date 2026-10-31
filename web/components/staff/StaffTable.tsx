'use client'

import { useState } from 'react'
import { Trash2, KeyRound, Eye, EyeOff, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { ROLE_LABELS, ROLE_COLORS, cn } from '@/lib/utils'
import type { Role } from '@/types'
import { deleteStaff, resetStaffPassword, changeStaffRole } from '@/app/(dashboard)/staff/actions'

const ALL_ROLES: Role[] = ['admin', 'deputy', 'teacher', 'class_teacher', 'psychologist', 'nurse', 'security', 'manager']

interface StaffMember {
  id: string; full_name: string; email: string; role: string
  class_id: string | null; class_ids: string[]; class_names: string[]; obs_count: number
}
interface ClassItem { id: string; name: string; grade?: number | null; letter?: string | null }

export function StaffTable({ staff: initial, classes, currentUserId }: {
  staff: StaffMember[]; classes: ClassItem[]; currentUserId: string
}) {
  const [staff, setStaff] = useState(initial)
  const [activeRole, setActiveRole] = useState<Role | null>(null)
  const [obsFilter, setObsFilter] = useState<'all' | 'has' | 'none'>('all')
  const [obsSort, setObsSort] = useState<'none' | 'asc' | 'desc'>('none')
  const [passwordModal, setPasswordModal] = useState<{ name: string; password: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [classModal, setClassModal] = useState<{ userId: string; newRole: string } | null>(null)
  const [pickedClassIds, setPickedClassIds] = useState<string[]>([])
  const [isNewClass, setIsNewClass] = useState(false)
  const [newGrade, setNewGrade] = useState('')
  const [newLetter, setNewLetter] = useState('')

  function togglePicked(id: string) {
    setPickedClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const visibleRoles = ALL_ROLES.filter(r => staff.some(s => s.role === r))

  let filtered = activeRole ? staff.filter(s => s.role === activeRole) : [...staff]
  if (obsFilter === 'has') filtered = filtered.filter(s => s.obs_count > 0)
  if (obsFilter === 'none') filtered = filtered.filter(s => s.obs_count === 0)
  if (obsSort === 'asc') filtered = [...filtered].sort((a, b) => a.obs_count - b.obs_count)
  if (obsSort === 'desc') filtered = [...filtered].sort((a, b) => b.obs_count - a.obs_count)

  function toggleObsSort() {
    setObsSort(prev => prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none')
  }

  async function handleDelete(id: string, name: string) {
    const obs = staff.find(s => s.id === id)?.obs_count ?? 0
    const question = obs > 0
      ? `У «${name}» есть наблюдения (${obs}), поэтому аккаунт будет деактивирован: вход заблокируется, сотрудник пропадёт из списка, а наблюдения останутся. Продолжить?`
      : `Удалить «${name}»? Это действие нельзя отменить.`
    if (!confirm(question)) return
    setLoadingId(id)
    const res = await deleteStaff(id)
    if (res.error) alert(res.error)
    else {
      setStaff(prev => prev.filter(s => s.id !== id))
      if ('deactivated' in res && res.deactivated) alert(`«${name}» деактивирован. Наблюдения сохранены.`)
    }
    setLoadingId(null)
  }

  async function handleReset(id: string, name: string) {
    if (!confirm(`Сбросить пароль «${name}»?`)) return
    setLoadingId(id)
    const res = await resetStaffPassword(id)
    if (res.error) alert(res.error)
    else if (res.password) { setPasswordModal({ name, password: res.password }); setShowPassword(false) }
    setLoadingId(null)
  }

  function openClassModal(id: string, newRole: string, preselect: string[]) {
    setPickedClassIds(preselect)
    setIsNewClass(false); setNewGrade(''); setNewLetter('')
    setClassModal({ userId: id, newRole })
  }

  function handleRoleSelect(id: string, newRole: string, currentRole: string) {
    if (newRole === currentRole) return
    if (newRole === 'class_teacher') {
      openClassModal(id, newRole, staff.find(s => s.id === id)?.class_ids ?? [])
    } else {
      applyRoleChange(id, newRole, [], [])
    }
  }

  async function applyRoleChange(
    id: string, newRole: string, classIds: string[] = [], classNames: string[] = [],
    newClass?: { grade: number; letter: string },
  ) {
    setLoadingId(id)
    const res = await changeStaffRole(id, newRole, classIds, newClass)
    if (res.error) { alert(res.error); setLoadingId(null); return }
    const resolvedIds = (res.classIds as string[] | undefined) ?? classIds
    setStaff(prev => prev.map(s => s.id === id ? {
      ...s, role: newRole,
      class_id: newRole === 'class_teacher' ? (resolvedIds[0] ?? null) : null,
      class_ids: newRole === 'class_teacher' ? resolvedIds : [],
      class_names: newRole === 'class_teacher' ? classNames : [],
    } : s))
    setLoadingId(null)
  }

  async function confirmClassModal() {
    if (!classModal) return
    const hasNew = isNewClass && newGrade && newLetter
    if (pickedClassIds.length === 0 && !hasNew) { alert('Выберите хотя бы один класс'); return }
    if (isNewClass && (!newGrade || !newLetter)) { alert('Укажите параллель и букву'); return }
    const names = [
      ...pickedClassIds.map(id => classes.find(c => c.id === id)?.name ?? '').filter(Boolean),
      ...(hasNew ? [`${newGrade}${newLetter}`] : []),
    ]
    const newClass = hasNew ? { grade: parseInt(newGrade), letter: newLetter } : undefined
    setClassModal(null)
    await applyRoleChange(classModal.userId, classModal.newRole, pickedClassIds, names, newClass)
  }

  return (
    <>
      {/* Role filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setActiveRole(null)} className={cn('px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors', activeRole === null ? 'bg-[#2563EB] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300')}>
          Все ({staff.length})
        </button>
        {visibleRoles.map(role => (
          <button key={role} onClick={() => setActiveRole(activeRole === role ? null : role)}
            className={cn('px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border', activeRole === role ? 'bg-[#2563EB] text-white border-transparent' : cn(ROLE_COLORS[role], 'hover:opacity-80'))}>
            {ROLE_LABELS[role]} ({staff.filter(s => s.role === role).length})
          </button>
        ))}
      </div>


      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="bg-gray-50/60 border-b border-gray-100">
              <th className="sticky top-0 z-20 bg-gray-50 text-left text-xs font-medium text-gray-400 px-5 py-3">Сотрудник</th>
              <th className="sticky top-0 z-20 bg-gray-50 text-left text-xs font-medium text-gray-400 pl-5 pr-2 py-3">Роль</th>
              <th className="sticky top-0 z-20 bg-gray-50 text-center text-xs font-medium text-gray-400 px-3 py-3">
                <button onClick={toggleObsSort} className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors">
                  Наблюдения
                  {obsSort === 'none' && <ArrowUpDown className="w-3 h-3" />}
                  {obsSort === 'desc' && <ArrowDown className="w-3 h-3 text-blue-500" />}
                  {obsSort === 'asc' && <ArrowUp className="w-3 h-3 text-blue-500" />}
                </button>
              </th>
              <th className="sticky top-0 z-20 bg-gray-50 text-left text-xs font-medium text-gray-400 px-5 py-3 hidden sm:table-cell">Email</th>
              <th className="sticky top-0 z-20 bg-gray-50 text-right text-xs font-medium text-gray-400 px-5 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const initials = s.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
              const isSelf = s.id === currentUserId
              const isLoading = loadingId === s.id
              return (
                <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50/50 isolate">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">{initials}</div>
                      <span className="text-sm font-medium text-gray-900">{s.full_name}</span>
                      {isSelf && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">вы</span>}
                    </div>
                  </td>
                  <td className="pl-5 pr-2 py-3 w-px whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {isSelf ? (
                        <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', ROLE_COLORS[s.role as Role])}>{ROLE_LABELS[s.role as Role]}</span>
                      ) : (
                        <div className="relative inline-block">
                          <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium pointer-events-none', ROLE_COLORS[s.role as Role])}>
                            {ROLE_LABELS[s.role as Role]}
                          </span>
                          <select value={s.role} disabled={isLoading}
                            onChange={e => handleRoleSelect(s.id, e.target.value, s.role)}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-default">
                            {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                        </div>
                      )}
                      {s.role === 'class_teacher' && !isSelf && (
                        <button
                          onClick={() => openClassModal(s.id, 'class_teacher', s.class_ids)}
                          disabled={isLoading}
                          title="Изменить классы"
                          className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                        >
                          {s.class_names.length > 0 ? s.class_names.join(', ') : 'выбрать классы'}
                        </button>
                      )}
                      {s.role === 'class_teacher' && isSelf && s.class_names.length > 0 && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{s.class_names.join(', ')}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center w-px">
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', s.obs_count > 0 ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-400')}>
                      {s.obs_count}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">{s.email}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleReset(s.id, s.full_name)} disabled={isLoading} title="Сбросить пароль"
                        className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {!isSelf && (
                        <button onClick={() => handleDelete(s.id, s.full_name)} disabled={isLoading} title="Удалить"
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center text-sm text-gray-400 py-10">Сотрудников пока нет</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Class picker modal */}
      {classModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Классы руководителя</h3>
              <button onClick={() => setClassModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Отметьте классы, которыми руководит сотрудник (можно несколько)</p>

            <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
              {classes.map(c => (
                <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-sm border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={pickedClassIds.includes(c.id)} onChange={() => togglePicked(c.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200" />
                  <span className="text-gray-700">{c.name}</span>
                </label>
              ))}
              {!isNewClass ? (
                <button type="button" onClick={() => setIsNewClass(true)} className="text-xs text-blue-500 hover:text-blue-700">➕ Создать новый класс</button>
              ) : (
                <div className="space-y-2 border border-gray-200 rounded-xl p-3">
                  <div className="flex gap-2">
                    <select value={newGrade} onChange={e => setNewGrade(e.target.value)}
                      className="w-28 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 bg-white">
                      <option value="">Паралл.</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input value={newLetter} onChange={e => setNewLetter(e.target.value)} placeholder="Буква / тип (А, Физмат...)"
                      className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
                  </div>
                  <button type="button" onClick={() => { setIsNewClass(false); setNewGrade(''); setNewLetter('') }} className="text-xs text-blue-500 hover:text-blue-700">← Отменить новый класс</button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setClassModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Отмена</button>
              <button onClick={confirmClassModal} className="flex-1 py-2.5 text-sm font-medium text-white bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8]">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Password modal */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Новый пароль</h3>
              <button onClick={() => setPasswordModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Пароль для <span className="font-medium text-gray-800">{passwordModal.name}</span> сброшен:</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <span className="flex-1 font-mono text-base tracking-widest text-gray-900">
                {showPassword ? passwordModal.password : '•'.repeat(passwordModal.password.length)}
              </span>
              <button onClick={() => setShowPassword(v => !v)} className="text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(passwordModal.password)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className={`mt-3 w-full py-2 text-sm border rounded-xl transition-colors ${copied ? 'text-green-600 border-green-200 bg-green-50' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}
            >
              {copied ? 'Скопировано' : 'Скопировать'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
