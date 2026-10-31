'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, Download } from 'lucide-react'
import { read, utils } from 'xlsx'
import { importStudents } from '@/app/(dashboard)/students/new/actions'

interface ParsedRow { full_name: string; class_name: string; parent_name: string; parent_phone: string }

const TEMPLATE_CSV =
  'ФИО,Класс,ФИО родителя,Телефон родителя\n' +
  'Иванов Иван Иванович,9А,Иванова Мария,+996 700 000 001\n' +
  'Петрова Анна Сергеевна,10Б,Петров Сергей,+996 700 000 002\n'

function downloadTemplate() {
  const blob = new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'шаблон_ученики.csv'; a.click()
  URL.revokeObjectURL(url)
}

async function parseFile(file: File): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer()
  const wb = read(new Uint8Array(buf), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: Record<string, string>[] = utils.sheet_to_json(ws, { defval: '' })
  return raw.map(r => ({
    full_name:    (r['ФИО'] ?? r['full_name'] ?? r['Имя'] ?? '').toString().trim(),
    class_name:   (r['Класс'] ?? r['class'] ?? r['Класс/группа'] ?? '').toString().trim(),
    parent_name:  (r['ФИО родителя'] ?? r['Родитель'] ?? '').toString().trim(),
    parent_phone: (r['Телефон родителя'] ?? r['Телефон'] ?? '').toString().trim(),
  })).filter(r => r.full_name)
}

export function ExcelImportPanel() {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported?: number; skipped?: number; error?: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setResult(null)
    setFileName(file.name)
    try {
      const parsed = await parseFile(file)
      setRows(parsed)
    } catch {
      setResult({ error: 'Не удалось прочитать файл. Убедитесь, что формат .xlsx, .xls или .csv.' })
      setRows([])
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function handleImport() {
    if (rows.length === 0) return
    setLoading(true)
    const res = await importStudents(rows)
    setResult(res)
    if (!res.error) { setRows([]); setFileName('') }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Импорт из Excel</h2>
          <p className="text-xs text-gray-400 mt-0.5">Классы и ученики создадутся автоматически</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Скачать шаблон
        </button>
      </div>

      {/* Drop zone */}
      {rows.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Upload className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-700">Перетащите файл сюда</p>
          <p className="text-xs text-gray-400 mt-1">или нажмите для выбора</p>
          <p className="text-xs text-blue-500 mt-2">.xlsx, .xls, .csv</p>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileSpreadsheet className="w-4 h-4 text-green-500" />
              <span className="font-medium truncate max-w-[180px]">{fileName}</span>
              <span className="text-gray-400">· {rows.length} учеников</span>
            </div>
            <button onClick={() => { setRows([]); setFileName(''); setResult(null) }} className="text-gray-400 hover:text-red-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="overflow-auto max-h-52">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['ФИО', 'Класс', 'ФИО родителя', 'Телефон'].map(h => (
                      <th key={h} className="text-left text-gray-400 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-3 py-1.5 text-gray-900 font-medium">{r.full_name}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.class_name || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.parent_name || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.parent_phone || '—'}</td>
                    </tr>
                  ))}
                  {rows.length > 50 && (
                    <tr><td colSpan={4} className="px-3 py-2 text-center text-gray-400">…ещё {rows.length - 50} записей</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={loading}
            className="w-full py-2.5 bg-[#2563EB] text-white text-sm font-medium rounded-xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-40"
          >
            {loading ? 'Импортируем...' : `Импортировать ${rows.length} учеников`}
          </button>
        </div>
      )}

      {/* Result */}
      {(result?.imported !== undefined || result?.skipped !== undefined) && !result?.error && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {result.imported! > 0
            ? `Импортировано ${result.imported} новых учеников.`
            : 'Новых учеников не обнаружено.'}
          {(result.skipped ?? 0) > 0 && ` ${result.skipped} уже существующих — пропущены.`}
        </div>
      )}
      {result?.error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {result.error}
        </div>
      )}

      {/* Format hint */}
      {rows.length === 0 && !result && (
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs font-medium text-gray-600 mb-1">Формат таблицы</p>
          <p className="text-xs text-gray-400">Колонки: <span className="text-gray-600">ФИО · Класс · ФИО родителя · Телефон родителя</span></p>
          <p className="text-xs text-gray-400 mt-0.5">Скачайте шаблон для правильного формата</p>
        </div>
      )}
    </div>
  )
}
