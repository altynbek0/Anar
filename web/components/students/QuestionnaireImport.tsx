'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, HelpCircle, Loader2, ChevronDown, Search } from 'lucide-react'
import { read, utils } from 'xlsx'
import { importFromQuestionnaires } from '@/app/(dashboard)/students/new/actions'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface TeacherRow {
  full_name: string; class_name: string; class_type: string; is_new: boolean; future_direction: string
  best_subjects: string; reaction: string; discipline: string; group_work: string
  communication: string; conflict: string; emotional: string; obstacles: string
  interests_hobbies: string; achievements: string; potential: string; important_notes: string
}
interface StudentRow  {
  full_name: string; class_name: string; goals: string; dream: string
  study_style: string; subjects: string; difficulties: string
  hobbies: string; career: string; motivation: string; fears: string; achievements: string
}
interface ParentRow   {
  full_name: string; class_name: string; parent_name: string; parent_phone: string
  family_situation: string; health_status: string; parent_goal: string; enrollment_year: string
  emotional: string; interests: string; career: string; study_home: string
  communication: string; obstacles: string; reaction_criticism: string; motivation_score: string
}

// ── Parsers ──────────────────────────────────────────────────────────────────

// Разбор CSV целиком, а не построчно: в ответах анкет (Google Forms) есть длинные тексты с
// переносами строк внутри кавычек. Раньше файл резался по «\n», и каждая строка такого текста
// становилась отдельной «записью» — отсюда ученики «креативна», «веселая и позитивная…» и классы-обрывки.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ }
        else inQ = false
      } else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      rows.push(row); row = []
    } else cur += ch
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim()))
}

function parseSheet<T>(buf: ArrayBuffer, mapper: (r: Record<string, string>) => T): T[] {
  const text = new TextDecoder('utf-8').decode(new Uint8Array(buf)).replace(/^﻿/, '')
  const table = parseCsv(text)
  if (table.length < 2) return []
  const headers = table[0].map(h => h.trim())
  const raw: Record<string, string>[] = table.slice(1).map(vals => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim() })
    return obj
  })
  return raw.map(mapper).filter((r: any) => (r as any).full_name?.trim())
}

const parseTeacher = (buf: ArrayBuffer): TeacherRow[] =>
  parseSheet(buf, r => {
    const scoreRaw = parseInt((r['Насколько ученик дисциплинирован и самостоятелен?'] ?? '').toString())
    const g = (key: string) => (r[key] ?? '').toString().trim()
    return {
      full_name:        g('ФИО ученика') || g('ФИО'),
      class_name:       g('Класс'),
      class_type:       g('Тип класса'),
      is_new:           g('Является ли ученик новым в школе?').toLowerCase().includes('да'),
      future_direction: g('В каком направлении вы видите будущее этого ученика?'),
      best_subjects:    g('Какие предметы даются ученику лучше всего?'),
      reaction:         g('Как ученик реагирует на трудные задачи?'),
      discipline:       scoreRaw ? `${scoreRaw}/10` : '',
      group_work:       g('Как ученик ведёт себя в групповой работе?'),
      communication:    g('Коммуникативные качества ученика'),
      conflict:         g('Умение выходить из конфликтных ситуаций'),
      emotional:        g('Эмоциональное состояние ученика'),
      obstacles:        g('Что больше всего мешает этому ученику? (можно несколько)') || g('Что больше всего мешает этому ученику?'),
      interests_hobbies: g('Какие интересы, увлечения или хобби есть у ученика?'),
      achievements:     g('Есть ли у ученика какие-либо достижения, которыми можно отметить его успехи?'),
      potential:        g('Оцените потенциал ученика при правильной поддержке'),
      important_notes:  g('Что важно знать об этом ученике — то, что не видно в оценках?') || g('Что важно знать об этом ученике?'),
    }
  })

const parseStudent = (buf: ArrayBuffer): StudentRow[] =>
  parseSheet(buf, r => {
    const surname = (r['Фамилия'] ?? '').toString().trim()
    const name    = (r['Имя'] ?? '').toString().trim()
    const full_name = [surname, name].filter(Boolean).join(' ')
      || (r['ФИО'] ?? r['ФИО ученика'] ?? '').toString().trim()
    return {
      full_name,
      class_name:   (r['Класс'] ?? '').toString().trim(),
      goals:        (r['Какова твоя главная цель на ближайший год?'] ?? '').toString().trim(),
      dream:        (r['Какая у тебя мечта?'] ?? '').toString().trim(),
      study_style:  (r['Как ты обычно учишься?'] ?? '').toString().trim(),
      subjects:     (r['Что из предметов даётся легче всего?'] ?? r['Любимые предметы'] ?? '').toString().trim(),
      difficulties: (r['Что вызывает наибольшие трудности?'] ?? '').toString().trim(),
      hobbies:      (r['Чем ты увлекаешься вне учёбы? Какие хобби или интересы?'] ?? r['Увлечения'] ?? '').toString().trim(),
      career:       (r['Какая профессия или сфера тебя привлекает?'] ?? '').toString().trim(),
      motivation:   (r['Что тебя реально мотивирует? (можно несколько)'] ?? r['Что тебя реально мотивирует?'] ?? '').toString().trim(),
      fears:        (r['Чего ты боишься больше всего в своём будущем?'] ?? '').toString().trim(),
      achievements: (r['Какие у тебя есть достижения?'] ?? '').toString().trim(),
    }
  })

const parseParent = (buf: ArrayBuffer): ParentRow[] =>
  parseSheet(buf, r => ({
    full_name:           (r['ФИО ребёнка'] ?? r['ФИО ученика'] ?? r['ФИО'] ?? '').toString().trim(),
    class_name:          (r['Класс'] ?? '').toString().trim(),
    parent_name:         (r['Ваше имя (родитель)'] ?? r['ФИО родителя'] ?? r['Родитель'] ?? '').toString().trim(),
    parent_phone:        (r['Ваш номер телефона'] ?? r['Телефон родителя'] ?? r['Телефон'] ?? '').toString().trim(),
    family_situation:    (r['Семейная обстановка'] ?? '').toString().trim(),
    health_status:       (r['Состояние здоровья ребёнка'] ?? '').toString().trim(),
    parent_goal:         (r['Какова ваша главная цель для ребёнка? (можно несколько)'] ?? r['Какова ваша главная цель для ребёнка?'] ?? '').toString().trim(),
    enrollment_year:     (r['В каком году ваш ребёнок поступил в нашу школу?'] ?? '').toString().trim(),
    emotional:           (r['Эмоциональное состояние ребёнка в последнее время'] ?? '').toString().trim(),
    interests:           (r['Какие интересы есть у вашего ребёнка?'] ?? '').toString().trim(),
    career:              (r['К какой профессии или направлении стремится ребёнок?'] ?? '').toString().trim(),
    study_home:          (r['Как ребёнок учится дома?'] ?? '').toString().trim(),
    communication:       (r['Коммуникативные качества ребёнка'] ?? '').toString().trim(),
    obstacles:           (r['Что, по вашему мнению, мешает ребёнку? (можно несколько)'] ?? r['Что, по вашему мнению, мешает ребёнку?'] ?? '').toString().trim(),
    reaction_criticism:  (r['Как ребёнок реагирует на критику или неудачи?'] ?? '').toString().trim(),
    motivation_score:    (r['Насколько сам ребёнок хочет достичь цели (не вы, а он)?'] ?? '').toString().trim(),
  }))

// ── Merge ────────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().replace(/[^а-яёa-z\s]/gi, '').replace(/\s+/g, ' ').trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function fuzzyMatch<T extends { full_name: string }>(target: string, candidates: T[], threshold = 0.82): T | undefined {
  const norm = normalize(target)
  let best: T | undefined
  let bestSim = threshold
  for (const c of candidates) {
    const cn = normalize(c.full_name)
    if (!cn) continue
    const sim = 1 - levenshtein(norm, cn) / Math.max(norm.length, cn.length, 1)
    if (sim > bestSim) { bestSim = sim; best = c }
  }
  return best
}

function mergeRows(teachers: TeacherRow[], students: StudentRow[], parents: ParentRow[]) {
  const studentMap = Object.fromEntries(students.map(r => [normalize(r.full_name), r]))
  const parentMap  = Object.fromEntries(parents.map(r => [normalize(r.full_name), r]))

  return teachers.map(t => {
    const key       = normalize(t.full_name)
    const tClass    = normalize(t.class_name)
    // First name = last word (Kyrgyz/Russian: "Фамилия Имя")
    const firstName = key.split(' ').pop() ?? ''

    const sameClassStudents = students.filter(r => normalize(r.class_name) === tClass)
    const sameClassParents  = parents.filter(r => normalize(r.class_name) === tClass)

    const s = studentMap[key]
      ?? fuzzyMatch(t.full_name, sameClassStudents.length ? sameClassStudents : students)
      // fallback: match by first name only (student wrote just their given name)
      ?? (firstName.length >= 3 ? fuzzyMatch(firstName, sameClassStudents.length ? sameClassStudents : students, 0.85) : undefined)

    const p = parentMap[key]
      ?? fuzzyMatch(t.full_name, sameClassParents.length ? sameClassParents : parents)

    const goalsArr = s?.goals?.trim() ? [s.goals.trim()] : []

    const lines: string[] = []
    if (!t.is_new) {
      if (t.best_subjects)     lines.push(`Предметы: ${t.best_subjects}`)
      if (t.reaction)          lines.push(`Реакция на трудности: ${t.reaction}`)
      if (t.discipline)        lines.push(`Дисциплина: ${t.discipline}`)
      if (t.group_work)        lines.push(`Групповая работа: ${t.group_work}`)
      if (t.communication)     lines.push(`Коммуникация: ${t.communication}`)
      if (t.conflict)          lines.push(`Конфликты: ${t.conflict}`)
      if (t.emotional)         lines.push(`Эмоц. состояние: ${t.emotional}`)
      if (t.obstacles)         lines.push(`Что мешает: ${t.obstacles}`)
      if (t.interests_hobbies) lines.push(`Интересы и хобби: ${t.interests_hobbies}`)
      if (t.future_direction)  lines.push(`Будущее направление (учитель): ${t.future_direction}`)
      if (t.achievements)      lines.push(`Достижения: ${t.achievements}`)
      if (t.potential)         lines.push(`Потенциал: ${t.potential}`)
      if (t.important_notes)   lines.push(`Важное: ${t.important_notes}`)
    }
    if (s?.study_style)  lines.push(`Как учится: ${s.study_style}`)
    if (s?.subjects)     lines.push(`Лёгкие предметы: ${s.subjects}`)
    if (s?.difficulties) lines.push(`Трудности: ${s.difficulties}`)
    if (s?.hobbies)      lines.push(`Увлечения: ${s.hobbies}`)
    if (s?.career)       lines.push(`Профессия: ${s.career}`)
    if (s?.motivation)   lines.push(`Мотивация: ${s.motivation}`)
    if (s?.fears)        lines.push(`Страхи: ${s.fears}`)
    if (s?.achievements) lines.push(`Достижения (сам): ${s.achievements}`)
    if (p?.emotional)           lines.push(`Эмоц. состояние (родитель): ${p.emotional}`)
    if (p?.interests)           lines.push(`Интересы (родитель): ${p.interests}`)
    if (p?.career)              lines.push(`Профессия (родитель): ${p.career}`)
    if (p?.study_home)          lines.push(`Учёба дома: ${p.study_home}`)
    if (p?.communication)       lines.push(`Коммуникация (родитель): ${p.communication}`)
    if (p?.obstacles)           lines.push(`Что мешает (родитель): ${p.obstacles}`)
    if (p?.reaction_criticism)  lines.push(`Реакция на критику: ${p.reaction_criticism}`)
    if (p?.motivation_score)    lines.push(`Мотивация к цели (родитель): ${p.motivation_score}/10`)

    // «Класс» (10) + «Тип класса» (А) → имя класса «10А». Матчинг выше идёт по «сырой»
    // параллели, поэтому склеиваем только здесь, в финальном результате.
    const parallel = (t.class_name ?? '').trim()
    const section  = (t.class_type ?? '').trim()
    const finalClassName = (/^\d+$/.test(parallel) && section) ? `${parallel}${section}` : parallel

    return {
      full_name:        t.full_name,
      class_name:       finalClassName,
      class_type:       (/^\d+$/.test(parallel) && section) ? '' : section,
      parent_name:      p?.parent_name ?? '',
      parent_phone:     p?.parent_phone ?? '',
      family_situation: p?.family_situation ?? '',
      health_status:    p?.health_status ?? '',
      parent_goal:      p?.parent_goal ?? '',
      enrollment_year:  p?.enrollment_year ?? '',
      dream:            s?.dream ?? '',
      goals:            goalsArr,
      teacher_notes:    lines.length ? `[Анкета учителя]\n${lines.join('\n')}` : '',
      _hasStudent:      !!s,
      _studentKey:      s?.full_name ?? null,
      _hasParent:       !!p,
      _parentKey:       p?.full_name ?? null,
    }
  })
}

type PreviewRow = ReturnType<typeof mergeRows>[0]

function applyStudentData(row: PreviewRow, s: StudentRow): PreviewRow {
  const extra: string[] = []
  if (s.study_style)  extra.push(`Как учится: ${s.study_style}`)
  if (s.subjects)     extra.push(`Лёгкие предметы: ${s.subjects}`)
  if (s.difficulties) extra.push(`Трудности: ${s.difficulties}`)
  if (s.hobbies)      extra.push(`Увлечения: ${s.hobbies}`)
  if (s.career)       extra.push(`Профессия: ${s.career}`)
  if (s.motivation)   extra.push(`Мотивация: ${s.motivation}`)
  if (s.fears)        extra.push(`Страхи: ${s.fears}`)
  if (s.achievements) extra.push(`Достижения (сам): ${s.achievements}`)
  return {
    ...row,
    goals: s.goals?.trim() ? [s.goals.trim()] : [],
    dream: s.dream ?? '',
    teacher_notes: [row.teacher_notes, ...extra].filter(Boolean).join('\n'),
    _hasStudent: true,
    _studentKey: s.full_name,
  }
}

function applyParentData(row: PreviewRow, p: ParentRow): PreviewRow {
  const extra: string[] = []
  if (p.emotional)          extra.push(`Эмоц. состояние (родитель): ${p.emotional}`)
  if (p.interests)          extra.push(`Интересы (родитель): ${p.interests}`)
  if (p.career)             extra.push(`Профессия (родитель): ${p.career}`)
  if (p.study_home)         extra.push(`Учёба дома: ${p.study_home}`)
  if (p.communication)      extra.push(`Коммуникация (родитель): ${p.communication}`)
  if (p.obstacles)          extra.push(`Что мешает (родитель): ${p.obstacles}`)
  if (p.reaction_criticism) extra.push(`Реакция на критику: ${p.reaction_criticism}`)
  if (p.motivation_score)   extra.push(`Мотивация к цели (родитель): ${p.motivation_score}/10`)
  return {
    ...row,
    parent_name:      p.parent_name,
    parent_phone:     p.parent_phone,
    family_situation: p.family_situation,
    health_status:    p.health_status,
    parent_goal:      p.parent_goal,
    enrollment_year:  p.enrollment_year,
    teacher_notes: [row.teacher_notes, ...extra].filter(Boolean).join('\n'),
    _hasParent: true,
    _parentKey: p.full_name,
  }
}

// ── Preview table ─────────────────────────────────────────────────────────────

function PreviewTable({ initialRows, students, parents, onConfirm, onBack, loading }: {
  initialRows: PreviewRow[]
  students: StudentRow[]
  parents: ParentRow[]
  onConfirm: (rows: PreviewRow[]) => void
  onBack: () => void
  loading: boolean
}) {
  const [rows, setRows]     = useState<PreviewRow[]>(initialRows)
  const [filter, setFilter] = useState<'all' | 'no_student' | 'no_parent'>('all')

  const usedStudentKeys = new Set(rows.filter(r => r._studentKey).map(r => r._studentKey!))
  const usedParentKeys  = new Set(rows.filter(r => r._parentKey).map(r => r._parentKey!))

  const freeStudents = students.filter(s => !usedStudentKeys.has(s.full_name)).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))
  const freeParents  = parents.filter(p => !usedParentKeys.has(p.full_name)).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))

  const studentMatched = rows.filter(r => r._hasStudent).length
  const parentMatched  = rows.filter(r => r._hasParent).length
  const noStudent      = rows.length - studentMatched
  const noParent       = rows.length - parentMatched

  function matchStudent(idx: number, fullName: string) {
    const s = students.find(r => r.full_name === fullName)
    if (!s) return
    setRows(prev => prev.map((r, i) => i === idx ? applyStudentData(r, s) : r))
  }

  function matchParent(idx: number, fullName: string) {
    const p = parents.find(r => r.full_name === fullName)
    if (!p) return
    setRows(prev => prev.map((r, i) => i === idx ? applyParentData(r, p) : r))
  }

  const displayRows = filter === 'no_student' ? rows.map((r, i) => ({ r, i })).filter(({ r }) => !r._hasStudent)
    : filter === 'no_parent' ? rows.map((r, i) => ({ r, i })).filter(({ r }) => !r._hasParent)
    : rows.map((r, i) => ({ r, i }))

  const tabs: [typeof filter, string, number][] = [
    ['all',        'Все',                rows.length],
    ['no_student', 'Без анкеты ученика', noStudent],
    ['no_parent',  'Без анкеты родителя', noParent],
  ]

  return (
    <div className="space-y-4">
      {/* Stats + actions */}
      <div className="bg-white rounded-2xl border border-gray-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <div>
            <span className="text-xl font-bold text-gray-900">{rows.length}</span>
            <span className="text-sm text-gray-400 ml-1.5">учеников</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            {studentMatched} из анкеты ученика
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" />
            {parentMatched} из анкеты родителя
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Назад
          </button>
          <button
            onClick={() => onConfirm(rows)}
            disabled={loading}
            className={cn(
              'flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
              loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Импортируем...' : `Импортировать ${rows.length} уч.`}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
              filter === key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700'
            )}
          >
            {label} <span className="opacity-60">({count})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100">
              <tr>
                {['ФИО ученика', 'Класс', 'Анкета ученика', 'Анкета родителя', 'Цель', 'Родитель'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map(({ r, i }) => (
                <tr
                  key={r.full_name + i}
                  className={cn(
                    'border-t border-gray-50',
                    !r._hasStudent || !r._hasParent ? 'bg-orange-50/30' : 'hover:bg-gray-50/40'
                  )}
                >
                  <td className="px-4 py-2 font-medium text-gray-800 whitespace-nowrap">{r.full_name}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{r.class_name || '—'}</td>

                  {/* Student match cell */}
                  <td className="px-4 py-2">
                    {r._hasStudent
                      ? <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Совпало</span>
                      : <SearchSelect
                          placeholder="Выбрать ученика..."
                          emptyLabel="Все уже привязаны"
                          onSelect={v => matchStudent(i, v)}
                          options={freeStudents.map(s => ({ value: s.full_name, label: s.full_name || `(без фамилии) кл. ${s.class_name}` }))}
                        />
                    }
                  </td>

                  {/* Parent match cell */}
                  <td className="px-4 py-2">
                    {r._hasParent
                      ? <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Совпало</span>
                      : <SearchSelect
                          placeholder="Выбрать родителя..."
                          emptyLabel="Все уже привязаны"
                          onSelect={v => matchParent(i, v)}
                          options={freeParents.map(p => ({ value: p.full_name, label: `${p.full_name}${p.parent_name ? ` (${p.parent_name})` : ''}` }))}
                        />
                    }
                  </td>

                  <td className="px-4 py-2 text-gray-600 max-w-[200px] truncate">{r.goals[0] || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{r.parent_name || '—'}</td>
                </tr>
              ))}
              {displayRows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-sm text-gray-400 py-8">Нет записей</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── File type detection ───────────────────────────────────────────────────────

function detectFileType(buf: ArrayBuffer): 'teacher' | 'student' | 'parent' | 'unknown' {
  const text = new TextDecoder('utf-8').decode(new Uint8Array(buf)).replace(/^﻿/, '')
  const headers = (parseCsv(text)[0] ?? []).map(h => h.trim().toLowerCase())
  const has = (substr: string) => headers.some(h => h.includes(substr))

  if (has('дисциплинирован') || has('тип класса') || has('направлении вы видите')) return 'teacher'
  if (has('главная цель на ближайший') || has('какая у тебя мечта') || has('как ты обычно учишься')) return 'student'
  if (has('ваше имя (родитель)') || has('фио родителя') || has('семейная обстановка') || has('фио ребёнка')) return 'parent'
  return 'unknown'
}

const FILE_TYPE_LABELS: Record<string, string> = {
  teacher: 'анкету учителя',
  student: 'анкету ученика',
  parent:  'анкету родителя',
}

// ── Single drop-zone ─────────────────────────────────────────────────────────

interface ZoneConfig {
  label: string
  sublabel: string
  tooltip: string
  accent: string
  accentBg: string
}

const ZONES: Record<'teacher' | 'student' | 'parent', ZoneConfig> = {
  teacher: {
    label:    'Анкета учителя',
    sublabel: 'Заполняется классным руководителем',
    tooltip:  'Колонки: ФИО ученика · Класс · Зона риска · Цели\nЗона риска: норма / средний / высокий',
    accent:   'text-blue-600',
    accentBg: 'bg-blue-50 border-blue-200',
  },
  student: {
    label:    'Анкета ученика',
    sublabel: 'Заполняется самим учеником',
    tooltip:  'Колонки: Фамилия · Имя · Класс · Что из предметов даётся легче всего? · Чем ты увлекаешься? · Какова твоя главная цель?',
    accent:   'text-purple-600',
    accentBg: 'bg-purple-50 border-purple-200',
  },
  parent: {
    label:    'Анкета родителя',
    sublabel: 'Заполняется родителем',
    tooltip:  'Колонки: ФИО ребёнка · Класс · Ваше имя (родитель) · Ваш номер телефона',
    accent:   'text-teal-600',
    accentBg: 'bg-teal-50 border-teal-200',
  },
}

// Компактный выпадающий список с поиском по ФИО (замена нативного select)
function SearchSelect({ options, placeholder, emptyLabel, onSelect }: {
  options: { value: string; label: string }[]
  placeholder: string
  emptyLabel: string
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const filtered = q.trim()
    ? options.filter(o => o.label.toLowerCase().includes(q.trim().toLowerCase()))
    : options

  return (
    <div ref={ref} className="relative w-[170px]">
      <button
        type="button"
        onClick={() => options.length && setOpen(o => !o)}
        disabled={options.length === 0}
        className="w-full flex items-center justify-between gap-1 text-xs border border-orange-200 bg-orange-50 text-orange-700 rounded-lg px-2 py-1 outline-none cursor-pointer disabled:cursor-default disabled:opacity-70"
      >
        <span className="truncate">{selected ?? (options.length ? placeholder : emptyLabel)}</span>
        {options.length > 0 && <ChevronDown className="w-3 h-3 flex-shrink-0" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-60 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Поиск по ФИО..."
              autoFocus
              className="w-full py-2 text-xs outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map((o, idx) => (
              <button
                key={o.value + idx}
                type="button"
                onClick={() => { setSelected(o.label); onSelect(o.value); setOpen(false); setQ('') }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-orange-50 truncate"
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">Ничего не найдено</p>}
          </div>
        </div>
      )}
    </div>
  )
}

interface DropZoneProps {
  type: 'teacher' | 'student' | 'parent'
  onParsed: (rows: any[], fileName: string) => void
  onClear: () => void
  fileName: string | null
  rowCount: number
  error: string | null
  parseRows: (buf: ArrayBuffer) => any[]
}

function DropZone({ type, onParsed, onClear, fileName, rowCount, error, parseRows }: DropZoneProps) {
  const z = ZONES[type]
  const [dragging, setDragging] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showTip, setShowTip] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setParseError(null)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Принимается только .csv файл. Экспортируйте таблицу из Google Sheets как CSV.')
      return
    }
    try {
      const buf = await file.arrayBuffer()
      const detected = detectFileType(buf)
      if (detected !== 'unknown' && detected !== type) {
        setParseError(`Вы загрузили ${FILE_TYPE_LABELS[detected]}, а нужна ${FILE_TYPE_LABELS[type]}. Пожалуйста, загрузите правильный файл.`)
        return
      }
      const rows = parseRows(buf)
      if (rows.length === 0) {
        setParseError('Файл пустой или колонки не распознаны')
        return
      }
      onParsed(rows, file.name)
    } catch {
      setParseError('Не удалось прочитать файл')
    }
  }, [type, parseRows, onParsed])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const loaded = !!fileName

  return (
    <div className={cn('rounded-2xl border p-8 flex flex-col gap-5 transition-colors', loaded ? z.accentBg : 'bg-white border-gray-100')}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className={cn('text-base font-semibold', loaded ? z.accent : 'text-gray-900')}>{z.label}</span>
            {/* Tooltip */}
            <div className="relative" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
              <HelpCircle className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help transition-colors" />
              {showTip && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-900 text-white text-[11px] rounded-xl px-3 py-2.5 z-50 shadow-lg pointer-events-none whitespace-pre-line leading-relaxed">
                  {z.tooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">{z.sublabel}</p>
        </div>
        {loaded && (
          <button onClick={onClear} className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Drop zone or loaded state */}
      {!loaded ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl py-14 text-center cursor-pointer transition-colors',
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm text-gray-500 font-medium">Перетащите или нажмите</p>
          <p className="text-xs text-gray-400 mt-1">только .csv</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-white/70 rounded-xl px-4 py-4">
          <FileSpreadsheet className={cn('w-6 h-6 flex-shrink-0', z.accent)} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{fileName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{rowCount} записей</p>
          </div>
          <CheckCircle2 className={cn('w-5 h-5 flex-shrink-0', z.accent)} />
        </div>
      )}

      {/* Errors */}
      {(parseError || error) && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {parseError ?? error}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function QuestionnaireImport() {
  const [teacherRows, setTeacherRows] = useState<TeacherRow[] | null>(null)
  const [studentRows, setStudentRows] = useState<StudentRow[] | null>(null)
  const [parentRows,  setParentRows]  = useState<ParentRow[]  | null>(null)

  const [teacherFile, setTeacherFile] = useState<string | null>(null)
  const [studentFile, setStudentFile] = useState<string | null>(null)
  const [parentFile,  setParentFile]  = useState<string | null>(null)

  const [step, setStep]             = useState<'upload' | 'preview'>('upload')
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null)
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<{ imported?: number; skipped?: number; error?: string } | null>(null)

  const allLoaded = teacherRows !== null && studentRows !== null && parentRows !== null

  function handlePreview() {
    if (!teacherRows || !studentRows || !parentRows) return
    setPreviewRows(mergeRows(teacherRows, studentRows, parentRows))
    setStep('preview')
    setResult(null)
  }

  async function handleImport(finalRows: PreviewRow[]) {
    setLoading(true)
    setResult(null)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const toSend = finalRows.map(({ _hasStudent, _hasParent, ...rest }) => rest)
    const res = await importFromQuestionnaires(toSend)
    setResult(res)
    if (!res.error) {
      setTeacherRows(null); setTeacherFile(null)
      setStudentRows(null); setStudentFile(null)
      setParentRows(null);  setParentFile(null)
      setPreviewRows(null); setStep('upload')
    }
    setLoading(false)
  }

  if (step === 'preview' && previewRows) {
    return (
      <div className="space-y-4">
        <PreviewTable
          initialRows={previewRows}
          students={studentRows ?? []}
          parents={parentRows ?? []}
          onConfirm={handleImport}
          onBack={() => setStep('upload')}
          loading={loading}
        />
        {(result?.imported !== undefined || result?.skipped !== undefined) && !result?.error && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>
              {result.imported! > 0 ? `Создано ${result.imported} новых профилей. ` : ''}
              {(result.skipped ?? 0) > 0 ? `${result.skipped} профилей обновлено. ` : ''}
              {(result as any).observations > 0 ? `Сохранено ${(result as any).observations} записей из анкет.` : 'Данные анкет не обнаружены.'}
            </span>
          </div>
        )}
        {result?.error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {result.error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 3 zones */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DropZone
          type="teacher"
          parseRows={parseTeacher}
          fileName={teacherFile}
          rowCount={teacherRows?.length ?? 0}
          error={null}
          onParsed={(rows, name) => { setTeacherRows(rows); setTeacherFile(name); setResult(null) }}
          onClear={() => { setTeacherRows(null); setTeacherFile(null) }}
        />
        <DropZone
          type="student"
          parseRows={parseStudent}
          fileName={studentFile}
          rowCount={studentRows?.length ?? 0}
          error={null}
          onParsed={(rows, name) => { setStudentRows(rows); setStudentFile(name); setResult(null) }}
          onClear={() => { setStudentRows(null); setStudentFile(null) }}
        />
        <DropZone
          type="parent"
          parseRows={parseParent}
          fileName={parentFile}
          rowCount={parentRows?.length ?? 0}
          error={null}
          onParsed={(rows, name) => { setParentRows(rows); setParentFile(name); setResult(null) }}
          onClear={() => { setParentRows(null); setParentFile(null) }}
        />
      </div>

      {/* Status bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-2xl border border-gray-100 px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          {(['teacher', 'student', 'parent'] as const).map((key) => {
            const loaded = key === 'teacher' ? !!teacherRows : key === 'student' ? !!studentRows : !!parentRows
            const z = ZONES[key]
            return (
              <div key={key} className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', loaded ? 'bg-green-400' : 'bg-gray-200')} />
                <span className={cn('text-xs', loaded ? z.accent + ' font-medium' : 'text-gray-400')}>
                  {z.label}
                </span>
              </div>
            )
          })}
        </div>

        <button
          onClick={handlePreview}
          disabled={!allLoaded}
          className={cn(
            'flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
            allLoaded
              ? 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          Предпросмотр →
        </button>
      </div>

      {!allLoaded && (
        <p className="text-xs text-gray-400 text-center -mt-3">
          Загрузите все три анкеты, чтобы увидеть предпросмотр
        </p>
      )}

      {/* Result */}
      {(result?.imported !== undefined || result?.skipped !== undefined) && !result?.error && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {result.imported! > 0
            ? `Создано ${result.imported} новых профилей.`
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
    </div>
  )
}
