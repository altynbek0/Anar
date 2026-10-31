'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Download, Printer, Share2, BookOpen, X, Loader2 } from 'lucide-react'
import { getStudentBookData } from '@/app/(dashboard)/student-book/actions'
import type { BookData } from '@/lib/pdf/types'
import { useI18n } from '@/lib/i18n/I18nProvider'

const BookPreview = dynamic(
  () => import('@/components/pdf/StudentBookPreview').then((m) => m.StudentBookPreview),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div> },
)



interface ClassItem { id: string; name: string }
interface StudentItem { id: string; full_name: string; class_id: string; photo_url?: string | null }

const CONTENTS = ['book.cover', 'book.profile', 'book.summaries', 'book.observations']

export function StudentBookClient({ classes, students }: { classes: ClassItem[]; students: StudentItem[] }) {
  const { t } = useI18n()
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'download' | 'print' | 'share' | null>(null)
  const [genError, setGenError] = useState('')
  const [bookData, setBookData] = useState<BookData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const comboRef = useRef<HTMLDivElement>(null)

  // Загружаем данные книги при выборе ученика — для живого предпросмотра PDF
  useEffect(() => {
    if (!studentId) { setBookData(null); return }
    let cancelled = false
    setPreviewLoading(true); setBookData(null); setGenError('')
    getStudentBookData(studentId)
      .then((res) => {
        if (cancelled) return
        if (res.error || !res.data) setGenError(res.error ?? t('book.errData'))
        else setBookData(res.data)
      })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [studentId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const byClass = classId ? students.filter((s) => s.class_id === classId) : students
  const filteredStudents = search.trim()
    ? byClass.filter((s) => s.full_name.toLowerCase().includes(search.toLowerCase()))
    : byClass

  const selectedStudent = students.find((s) => s.id === studentId)

  function selectStudent(s: StudentItem) {
    setStudentId(s.id)
    setSearch(s.full_name)
    setOpen(false)
  }

  function clearStudent() {
    setStudentId('')
    setSearch('')
    setOpen(false)
  }

  async function buildBlob(): Promise<Blob | null> {
    let data = bookData
    if (!data) {
      const res = await getStudentBookData(studentId)
      if (res.error || !res.data) { setGenError(res.error ?? t('book.errData')); return null }
      data = res.data
    }
    const { generateBookBlob } = await import('@/lib/pdf/StudentBookDocument')
    return await generateBookBlob(data)
  }

  async function run(kind: 'download' | 'print' | 'share', action: (blob: Blob) => void | Promise<void>) {
    if (!studentId || !selectedStudent || busy) return
    setBusy(kind)
    setGenError('')
    try {
      const blob = await buildBlob()
      if (blob) await action(blob)
    } catch (e) {
      console.error(e)
      setGenError(t('book.errPdf'))
    } finally {
      setBusy(null)
    }
  }

  const fileName = () => `${t('book.title')} — ${selectedStudent?.full_name ?? ''}.pdf`

  function handleDownload() {
    run('download', (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName()
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    })
  }

  function handlePrint() {
    run('print', (blob) => {
      const url = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'
      iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0'
      iframe.src = url
      iframe.onload = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } catch { /* ignore */ } }
      document.body.appendChild(iframe)
      setTimeout(() => { iframe.remove(); URL.revokeObjectURL(url) }, 60000)
    })
  }

  function handleShare() {
    run('share', async (blob) => {
      const file = new File([blob], fileName(), { type: 'application/pdf' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try { await nav.share({ files: [file], title: t('book.title') }) } catch { /* пользователь отменил */ }
      } else {
        // запасной вариант — скачивание
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = file.name
        document.body.appendChild(a); a.click(); a.remove()
        URL.revokeObjectURL(url)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('book.title')}</h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{t('book.subtitle')}</p>
      </div>

      {/* Controls bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:px-5 sm:py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <BookOpen className="hidden sm:block w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 whitespace-nowrap">{t('book.classLabel')}</span>
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setStudentId('') }}
              className="flex-1 px-2.5 py-2 sm:py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 bg-white"
            >
              <option value="">{t('obs.allClasses')}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 whitespace-nowrap">{t('book.studentLabel')}</span>
            <div ref={comboRef} className="relative flex-1">
              <div className="flex items-center border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-100">
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setStudentId(''); setOpen(true) }}
                  onFocus={() => setOpen(true)}
                  placeholder={t('book.searchName')}
                  className="px-2.5 py-2 sm:py-1.5 text-sm outline-none bg-transparent flex-1 min-w-0 w-full"
                />
                {search && (
                  <button onClick={clearStudent} className="pr-2 text-gray-400 hover:text-gray-600 flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {open && filteredStudents.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredStudents.map((s) => (
                    <button
                      key={s.id}
                      onMouseDown={() => selectStudent(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      {s.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {selectedStudent ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handlePrint}
                disabled={!!busy}
                className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600 px-3 py-2 sm:py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                {t('book.print')}
              </button>
              <button
                onClick={handleShare}
                disabled={!!busy}
                className="flex items-center gap-1.5 text-sm text-gray-600 px-3 py-2 sm:py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                {t('book.share')}
              </button>
              <button
                onClick={handleDownload}
                disabled={!!busy}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 text-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 sm:py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t('book.download')}
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{t('book.selectStudent')}</span>
          )}
        </div>
      </div>

      {genError && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{genError}</p>
      )}

      {/* Main: real PDF preview + contents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Live PDF preview — scrollable */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden h-[720px]">
          {!selectedStudent ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">{t('book.selectForPreview')}</p>
              </div>
            </div>
          ) : previewLoading || !bookData ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
            </div>
          ) : (
            <BookPreview data={bookData} />
          )}
        </div>

        {/* Contents */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-5">{t('book.contents')}</h3>
          <ol className="space-y-4">
            {CONTENTS.map((key, i) => (
              <li key={key} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold flex-shrink-0">
                  {i + 1}
                </span>
                {t(key)}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

