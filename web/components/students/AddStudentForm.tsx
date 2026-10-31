'use client'

import { useActionState, useState } from 'react'
import { addStudent } from '@/app/(dashboard)/students/new/actions'
import { User, Phone, BookOpen, Target } from 'lucide-react'

interface ClassItem { id: string; name: string }

export function AddStudentForm({ classes }: { classes: ClassItem[] }) {
  const [state, action, pending] = useActionState(addStudent, null)
  const [isNewClass, setIsNewClass] = useState(classes.length === 0)

  return (
    <form action={action} className="space-y-6">
      {/* Full name */}
      <Field label="ФИО ученика *" icon={<User className="w-4 h-4" />}>
        <input
          name="full_name"
          required
          placeholder="Фамилия Имя Отчество"
          className={INPUT_CLS}
        />
      </Field>

      {/* Class */}
      <Field label="Класс" icon={<BookOpen className="w-4 h-4" />}>
        {!isNewClass ? (
          <div className="space-y-2">
            <select
              name="class_id"
              className={INPUT_CLS}
              onChange={(e) => { if (e.target.value === '__new__') setIsNewClass(true) }}
            >
              <option value="">Без класса</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">➕ Создать новый класс</option>
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <input type="hidden" name="class_id" value="__new__" />
            <div className="flex gap-2">
              <select name="new_class_grade" className={`${INPUT_CLS} w-28`} defaultValue="">
                <option value="" disabled>Параллель</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <input
                name="new_class_letter"
                placeholder="Буква / тип (А, Физмат...)"
                autoFocus
                className={INPUT_CLS}
              />
            </div>
            <p className="text-xs text-gray-400">Например: параллель 9 + буква А → класс 9А</p>
            {classes.length > 0 && (
              <button
                type="button"
                onClick={() => setIsNewClass(false)}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                ← Выбрать существующий класс
              </button>
            )}
          </div>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Parent name */}
        <Field label="ФИО родителя" icon={<User className="w-4 h-4" />}>
          <input
            name="parent_name"
            placeholder="Фамилия Имя Отчество"
            className={INPUT_CLS}
          />
        </Field>

        {/* Parent phone */}
        <Field label="Телефон родителя" icon={<Phone className="w-4 h-4" />}>
          <input
            name="parent_phone"
            type="tel"
            placeholder="+996 (___) ___-___"
            className={INPUT_CLS}
          />
        </Field>
      </div>

      {/* Goals */}
      <Field label="Цели ученика" icon={<Target className="w-4 h-4" />}>
        <textarea
          name="goals"
          rows={3}
          placeholder={"Поступить в MIT\nСтать разработчиком\nИзучить английский"}
          className={`${INPUT_CLS} resize-none`}
        />
        <p className="text-xs text-gray-400 mt-1">Каждая цель с новой строки</p>
      </Field>

      {/* Error */}
      {state?.error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{state.error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <a
          href="/students"
          className="flex-1 py-3 text-center text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          Отмена
        </a>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-3 bg-[#2563EB] text-white text-sm font-medium rounded-xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-40"
        >
          {pending ? 'Создаём...' : 'Создать ученика'}
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
        <span className="text-gray-400">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  )
}
