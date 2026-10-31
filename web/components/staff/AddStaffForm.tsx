'use client'

import { useActionState, useState } from 'react'
import { addStaff } from '@/app/(dashboard)/staff/new/actions'
import { User, Mail, Lock, Shield, BookOpen } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/utils'
import type { Role } from '@/types'

const ROLES: Role[] = [
  'admin', 'deputy', 'teacher', 'class_teacher',
  'psychologist', 'nurse', 'security', 'manager',
]

interface ClassItem { id: string; name: string }

export function AddStaffForm({ classes }: { classes: ClassItem[] }) {
  const [state, action, pending] = useActionState(addStaff, null)
  const [role, setRole] = useState('')
  const [isNewClass, setIsNewClass] = useState(false)

  const isClassTeacher = role === 'class_teacher'

  return (
    <form action={action} className="space-y-6">
      <Field label="ФИО сотрудника *" icon={<User className="w-4 h-4" />}>
        <input name="full_name" required placeholder="Фамилия Имя Отчество" className={INPUT_CLS} />
      </Field>

      <Field label="Email *" icon={<Mail className="w-4 h-4" />}>
        <input name="email" type="email" required placeholder="ivan@school.kg" className={INPUT_CLS} />
      </Field>

      <Field label="Должность *" icon={<Shield className="w-4 h-4" />}>
        <select name="role" required className={INPUT_CLS} value={role} onChange={e => { setRole(e.target.value); setIsNewClass(false) }}>
          <option value="">Выберите должность...</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </Field>

      {/* Class picker — only for class_teacher (можно несколько) */}
      {isClassTeacher && (
        <Field label="Классы *" icon={<BookOpen className="w-4 h-4" />}>
          <div className="space-y-2">
            {classes.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {classes.map(c => (
                  <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" name="class_ids" value={c.id} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200" />
                    <span className="text-gray-700">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
            {!isNewClass ? (
              <button type="button" onClick={() => setIsNewClass(true)} className="text-xs text-blue-500 hover:text-blue-700">
                ➕ Создать новый класс
              </button>
            ) : (
              <div className="space-y-2 border border-gray-200 rounded-xl p-3">
                <input type="hidden" name="create_new_class" value="1" />
                <div className="flex gap-2">
                  <select name="new_class_grade" className={`${INPUT_CLS} w-28`} defaultValue="">
                    <option value="" disabled>Параллель</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <input name="new_class_letter" placeholder="Буква / тип (А, Физмат...)" autoFocus className={INPUT_CLS} />
                </div>
                <p className="text-xs text-gray-400">Например: 9 + А → класс 9А</p>
                <button type="button" onClick={() => setIsNewClass(false)} className="text-xs text-blue-500 hover:text-blue-700">
                  ← Отменить новый класс
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400">Можно выбрать несколько классов.</p>
          </div>
        </Field>
      )}

      <Field label="Пароль *" icon={<Lock className="w-4 h-4" />}>
        <input name="password" type="password" required minLength={8} placeholder="Минимум 8 символов" className={INPUT_CLS} />
        <p className="text-xs text-gray-400 mt-1">Сотрудник сможет изменить пароль после первого входа</p>
      </Field>

      {state?.error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{state.error}</p>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-600 font-medium mb-0.5">Что произойдёт после создания?</p>
        <p className="text-xs text-blue-500">Будет создан аккаунт в системе. Сотрудник сможет войти по email и паролю, которые вы указали.</p>
      </div>

      <div className="flex gap-3 pt-2">
        <a href="/staff" className="flex-1 py-3 text-center text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          Отмена
        </a>
        <button type="submit" disabled={pending} className="flex-1 py-3 bg-[#2563EB] text-white text-sm font-medium rounded-xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-40">
          {pending ? 'Создаём...' : 'Создать сотрудника'}
        </button>
      </div>
    </form>
  )
}

const INPUT_CLS = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white'

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
        <span className="text-gray-400">{icon}</span>{label}
      </label>
      {children}
    </div>
  )
}
