'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'
import { ReactionBar } from '@/components/observations/ReactionBar'
const NO_DATA = 'Данных пока недостаточно.'

const TABS = ['Обзор', 'Интересы', 'Успеваемость', 'Активность', 'Достижения', 'Психология']

const CATEGORY_LABELS: Record<string, string> = {
  academic: 'Академическое', behavior: 'Поведение', psychology: 'Психология',
  sport: 'Спорт', creative: 'Творчество', health: 'Здоровье', social: 'Социальное',
}
const CATEGORY_COLORS: Record<string, string> = {
  academic: 'bg-blue-100 text-blue-700', behavior: 'bg-yellow-100 text-yellow-700',
  psychology: 'bg-purple-100 text-purple-700', sport: 'bg-green-100 text-green-700',
  creative: 'bg-orange-100 text-orange-700', health: 'bg-red-100 text-red-700',
  social: 'bg-teal-100 text-teal-700',
}

type AiSummaries = Record<string, { content: string; updated_at: string } | undefined>

interface VersionRow { section: string; content: string; created_at: string }

// UI-вкладка → имя колонки/раздела в ai_insights (для истории). «Обзор» истории не имеет.
const TAB_COL: Record<string, string> = {
  Интересы: 'interests',
  Успеваемость: 'academic',
  Активность: 'extracurricular',
  Достижения: 'achievements',
  Психология: 'psychology',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StudentTabs({ student, observations, aiSummaries, versions = [], currentUserId }: {
  student: any; observations: any[]; aiSummaries: AiSummaries
  versions?: VersionRow[]; currentUserId: string
}) {
  const [active, setActive] = useState('Обзор')

  // История версий, сгруппированная по разделу (новые сверху — порядок задаёт запрос)
  const versionsByCol: Record<string, VersionRow[]> = {}
  for (const v of versions) (versionsByCol[v.section] ??= []).push(v)
  const historyFor = (tab: string) => <SummaryHistory versions={versionsByCol[TAB_COL[tab]] ?? []} />

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="flex border-b border-gray-100 px-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={cn(
                'px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                active === tab
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {active === 'Обзор'       && <OverviewTab     student={student} observations={observations} ai={aiSummaries['overview']} />}
          {active === 'Интересы'    && <><InterestsTab    ai={aiSummaries['interests']} />{historyFor('Интересы')}</>}
          {active === 'Успеваемость'&& <><PerformanceTab  ai={aiSummaries['performance']} />{historyFor('Успеваемость')}</>}
          {active === 'Активность'  && <><AiOnlyTab       ai={aiSummaries['activity']} />{historyFor('Активность')}</>}
          {active === 'Достижения'  && <><AiOnlyTab       ai={aiSummaries['achievements']} />{historyFor('Достижения')}</>}
          {active === 'Психология'  && <><AiOnlyTab       ai={aiSummaries['psychology']} />{historyFor('Психология')}</>}
        </div>
      </div>

      <ObservationsTable observations={observations} currentUserId={currentUserId} />
    </div>
  )
}

// История прошлых версий ИИ-сводки раздела (текущая версия показана выше в AiBlock).
function SummaryHistory({ versions }: { versions: VersionRow[] }) {
  const [open, setOpen] = useState(false)
  if (versions.length <= 1) return null // только текущая версия — истории ещё нет
  const past = versions.slice(1) // versions идут от новых к старым; [0] — текущая
  return (
    <div className="mt-5 pt-4 border-t border-gray-100">
      <button onClick={() => setOpen(o => !o)} className="text-xs text-blue-500 hover:text-blue-700">
        {open ? 'Скрыть прошлые сводки' : `Прошлые сводки (${past.length})`}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {past.map((v, i) => (
            <div key={`${v.created_at}-${i}`} className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 mb-1">
                {new Date(v.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <p className="text-xs text-gray-600 whitespace-pre-line">{v.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared AI block ───────────────────────────────────────────────────────────

function AiBlock({ summary }: { summary?: { content: string; updated_at: string } }) {
  const content = summary?.content
  const isEmpty = !content || content === NO_DATA
  const dateLabel = summary?.updated_at
    ? new Date(summary.updated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    : null

  return (
    <div className="bg-blue-50/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Image src="/icon.png" alt="Anar" width={20} height={20} className="w-5 h-5 rounded-md object-cover flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-900">AI сводка</span>
        {dateLabel && <span className="text-xs text-gray-400 ml-auto">{dateLabel}</span>}
      </div>
      <p className={cn('text-xs leading-relaxed whitespace-pre-line', isEmpty ? 'text-gray-400' : 'text-gray-700')}>
        {content ?? NO_DATA}
      </p>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OverviewTab({ student, observations, ai }: { student: any; observations: any[]; ai?: { content: string; updated_at: string } }) {
  const alertObs = observations.filter((o) => o.is_alert)
  const goalsText = (student.goals as string[] | null)?.filter(Boolean).join(', ') || null

  const briefRows: [string, string | number][] = [
    ['Наблюдений',         observations.length],
    ['Год поступления',    student.enrollment_year || '—'],
    ['Цель ученика',       goalsText               || '—'],
    ['Мечта',              student.dream           || '—'],
    ['Цель родителя',      student.parent_goal     || '—'],
    ['Семейная обстановка',student.family_situation|| '—'],
    ['Состояние здоровья', student.health_status   || '—'],
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Left: brief info */}
      <div>
        <p className="text-sm text-gray-600 mb-2">Краткая информация</p>
        <div className="h-px bg-gray-100 mb-3" />
        <div className="space-y-2.5">
          {briefRows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 text-sm">
              <span className="text-gray-400 flex-shrink-0">{label}</span>
              <span className="text-gray-800 text-right leading-snug">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Center: AI summary */}
      <AiBlock summary={ai} />

      {/* Right: alerts */}
      <div className="space-y-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className={cn('w-4 h-4', alertObs.length > 0 ? 'text-red-500' : 'text-green-500')} />
            <span className="text-xs font-medium text-gray-700">Тревожные сигналы</span>
          </div>
          <p className={cn('text-sm font-semibold', alertObs.length > 0 ? 'text-red-600' : 'text-green-600')}>
            {alertObs.length > 0 ? `${alertObs.length} сигналов` : 'Тревожных сигналов нет'}
          </p>
        </div>
        {alertObs.length > 0 && (
          <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
            {alertObs.map((obs) => (
              <div key={obs.id} className="flex items-start gap-2 bg-red-50/50 rounded-lg p-2">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5', CATEGORY_COLORS[obs.category] ?? 'bg-gray-100 text-gray-600')}>
                  {CATEGORY_LABELS[obs.category] ?? obs.category}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-gray-700 line-clamp-3">{obs.content}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{obs.author?.full_name ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InterestsTab({ ai }: { ai?: { content: string; updated_at: string } }) {
  return <AiBlock summary={ai} />
}

function PerformanceTab({ ai }: { ai?: { content: string; updated_at: string } }) {
  return <AiBlock summary={ai} />
}

function AiOnlyTab({ ai }: { ai?: { content: string; updated_at: string } }) {
  return <AiBlock summary={ai} />
}

// ── Observations table ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ObsRow({ obs, currentUserId }: { obs: any; currentUserId: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = obs.content?.length > 120

  return (
    <tr className="border-t border-gray-50 hover:bg-gray-50/40 align-top">
      <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
        {new Date(obs.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
      <td className="px-6 py-3 whitespace-nowrap">
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', CATEGORY_COLORS[obs.category] ?? 'bg-gray-100 text-gray-600')}>
          {CATEGORY_LABELS[obs.category] ?? obs.category}
        </span>
      </td>
      <td className="px-6 py-3 text-xs text-gray-700 max-w-sm">
        <p className={cn(!expanded && isLong && 'line-clamp-2')}>{obs.content}</p>
        {isLong && (
          <button onClick={() => setExpanded(p => !p)} className="text-[10px] text-blue-500 hover:text-blue-700 mt-0.5">
            {expanded ? 'Свернуть' : 'Раскрыть'}
          </button>
        )}
        <ReactionBar
          observationId={obs.id}
          currentUserId={currentUserId}
          initial={obs.reactions ?? []}
        />
      </td>
      <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">{obs.author?.full_name ?? '—'}</td>
      <td className="px-6 py-3 whitespace-nowrap">
        {obs.is_alert
          ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Тревога</span>
          : <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Норма</span>
        }
      </td>
    </tr>
  )
}

// Mobile card — table columns don't fit narrow screens, so stack the fields instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ObsCard({ obs, currentUserId }: { obs: any; currentUserId: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = obs.content?.length > 120

  return (
    <div className="px-4 py-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {new Date(obs.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        {obs.is_alert
          ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium flex-shrink-0">Тревога</span>
          : <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium flex-shrink-0">Норма</span>
        }
      </div>
      <span className={cn('inline-block text-[10px] px-2 py-0.5 rounded-full font-medium', CATEGORY_COLORS[obs.category] ?? 'bg-gray-100 text-gray-600')}>
        {CATEGORY_LABELS[obs.category] ?? obs.category}
      </span>
      <p className={cn('text-xs text-gray-700 leading-relaxed', !expanded && isLong && 'line-clamp-3')}>{obs.content}</p>
      {isLong && (
        <button onClick={() => setExpanded(p => !p)} className="text-[10px] text-blue-500 hover:text-blue-700">
          {expanded ? 'Свернуть' : 'Раскрыть'}
        </button>
      )}
      <ReactionBar
        observationId={obs.id}
        currentUserId={currentUserId}
        initial={obs.reactions ?? []}
      />
      <p className="text-[10px] text-gray-400 pt-0.5">{obs.author?.full_name ?? '—'}</p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ObservationsTable({ observations, currentUserId }: { observations: any[]; currentUserId: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Наблюдения</h2>
        <span className="text-xs text-gray-400">{observations.length} записей</span>
      </div>
      {/* Mobile: stacked cards */}
      <div className="sm:hidden max-h-[400px] overflow-y-auto divide-y divide-gray-50">
        {observations.map((obs) => <ObsCard key={obs.id} obs={obs} currentUserId={currentUserId} />)}
        {observations.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">Наблюдений пока нет</p>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block max-h-[400px] overflow-y-auto overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/60 border-b border-gray-100">
              <th className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-medium text-gray-400 px-6 py-3 whitespace-nowrap">Дата</th>
              <th className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-medium text-gray-400 px-6 py-3 whitespace-nowrap">Категория</th>
              <th className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-medium text-gray-400 px-6 py-3">Наблюдение</th>
              <th className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-medium text-gray-400 px-6 py-3 whitespace-nowrap">Автор</th>
              <th className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-medium text-gray-400 px-6 py-3 whitespace-nowrap">Статус</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((obs) => <ObsRow key={obs.id} obs={obs} currentUserId={currentUserId} />)}
            {observations.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-sm text-gray-400 py-10">Наблюдений пока нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
