'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'

export function MobileShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[220px] flex-shrink-0">
        <div className="fixed top-0 left-0 h-screen w-[220px]">
          {sidebar}
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`lg:hidden fixed top-0 left-0 w-[220px] z-50 transition-transform duration-200 ease-out shadow-xl ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ height: '100dvh' }}
      >
        {sidebar}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-30">
          <button
            onClick={() => setOpen(true)}
            className="w-9 h-9 rounded-xl border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
          <Link href="/" className="font-bold text-gray-900 text-[15px] hover:text-[#C93252] transition-colors">Anar</Link>
        </div>

        <main className="flex-1 overflow-auto pb-20">
          {children}
        </main>
      </div>
    </div>
  )
}
