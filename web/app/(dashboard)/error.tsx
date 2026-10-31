'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to monitoring service in production
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Что-то пошло не так</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-sm">
        Произошла неожиданная ошибка. Попробуйте обновить страницу.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2.5 bg-[#2563EB] text-white text-sm font-medium rounded-xl hover:bg-[#1D4ED8] transition-colors"
      >
        Попробовать снова
      </button>
    </div>
  )
}
