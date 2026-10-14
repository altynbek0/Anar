'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AssistantChat } from './AssistantChat'

// Плавающий ассистент директора: круглая кнопка с лого Anar в правом нижнем
// углу → выезжающая справа чат-панель (в стиле Copilot). Монтируется в
// DashboardShell только для admin/manager. Чат остаётся смонтированным, чтобы
// переписка сохранялась между открытиями.
export function AssistantWidget() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Плавающая кнопка */}
      <button
        onClick={() => setOpen(true)}
        aria-label="AI-ассистент"
        className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 w-14 h-14 rounded-full overflow-hidden shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:scale-105 hover:shadow-xl ${
          open ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100'
        }`}
      >
        <Image src="/icon.png" alt="Anar" width={56} height={56} className="w-full h-full object-cover" />
      </button>

      {/* Затемнение (только на мобиле) */}
      <div
        onClick={() => setOpen(false)}
        className={`sm:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Панель чата */}
      <div
        className={`fixed top-0 right-0 z-50 h-[100dvh] w-full sm:w-[420px] bg-white shadow-2xl border-l border-gray-100 transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-hidden={!open}
      >
        <AssistantChat onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
