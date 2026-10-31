'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { advanceSchoolYear, revertSchoolYear } from '@/app/(dashboard)/actions/school'

interface Props {
  schoolYear: number
  isAdmin: boolean
}

export function SchoolYearBadge({ schoolYear, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showRevert, setShowRevert] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const label = `${schoolYear}-${schoolYear + 1} учебный год`

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleAdvance() {
    setLoading(true)
    await advanceSchoolYear()
    setLoading(false)
    setShowConfirm(false)
    window.location.reload()
  }

  async function handleRevert() {
    setLoading(true)
    await revertSchoolYear()
    setLoading(false)
    setShowRevert(false)
    window.location.reload()
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => isAdmin && setOpen(!open)}
          className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
        >
          <span className="sm:hidden">{schoolYear}–{schoolYear + 1}</span>
          <span className="hidden sm:inline">{label}</span>
          {isAdmin && <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
        </button>

        {open && (
          <div className="absolute right-0 top-7 bg-white border border-gray-100 rounded-xl shadow-lg py-1 w-56 z-50">
            <button
              onClick={() => { setOpen(false); setShowConfirm(true) }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Перейти на новый учебный год
            </button>
            <div className="border-t border-gray-50 my-1" />
            <button
              onClick={() => { setOpen(false); setShowRevert(true) }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
            >
              Вернуться к прошлому году
            </button>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">Перейти на {schoolYear + 1}-{schoolYear + 2} учебный год?</h3>
            <p className="text-sm text-gray-500 mb-5">
              После подтверждения:
              <br />• Все классы перейдут на следующую параллель (8А → 9А и т.д.)
              <br />• Классы 11-й параллели станут 12-й — удалите их вручную если нужно
              <br />• Данные учеников и наблюдения сохранятся
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleAdvance}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                {loading ? 'Переходим...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showRevert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">Вернуться на {schoolYear - 1}-{schoolYear} учебный год?</h3>
            <p className="text-sm text-gray-500 mb-2">
              Все классы вернутся на предыдущую параллель (9А → 8А и т.д.).
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-5">
              ⚠️ Откат безопасен только если после перехода вы не добавляли и не редактировали классы вручную.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRevert(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleRevert}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50"
              >
                {loading ? 'Откатываем...' : 'Вернуть'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
