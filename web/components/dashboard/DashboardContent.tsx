'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Users, AlertTriangle, Eye, TrendingUp, TrendingDown, Sparkles, Trash2, ShieldAlert } from 'lucide-react'
import { deleteObservation, dismissAlert } from '@/app/(dashboard)/observations/actions'
import { SchoolYearBadge } from './SchoolYearBadge'
import { ReactionBar, type ReactionItem } from '@/components/observations/ReactionBar'
import { useI18n } from '@/lib/i18n/I18nProvider'
import type { Locale } from '@/lib/i18n/config'

const CATEGORY_COLORS: Record<string, string> = {
  academic: 'bg-blue-100 text-blue-700',
  behavior: 'bg-yellow-100 text-yellow-700',
  psychology: 'bg-purple-100 text-purple-700',
  sport: 'bg-green-100 text-green-700',
  creative: 'bg-orange-100 text-orange-700',
  health: 'bg-red-100 text-red-700',
  social: 'bg-teal-100 text-teal-700',
}

type TFn = (key: string, params?: Record<string, string | number>) => string
const dl = (locale: Locale) => (locale === 'en' ? 'en-US' : 'ru-RU')

function getGreeting(t: TFn) {
  const h = new Date().getHours()
  if (h < 12) return t('dash.morning')
  if (h < 18) return t('dash.day')
  return t('dash.evening')
}

function pluralizeObs(n: number, locale: Locale): string {
  if (locale === 'en') return `${n} observation${n === 1 ? '' : 's'}`
  const mod10 = n % 10, mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return `${n} наблюдений`
  if (mod10 === 1) return `${n} наблюдение`
  if (mod10 >= 2 && mod10 <= 4) return `${n} наблюдения`
  return `${n} наблюдений`
}


interface NoRecentObsItem {
  id: string
  full_name: string
  class_name: string
  days_since: number | null
}

interface TeacherStat { name: string; role: string; obsCount: number; lastObs: string | null }

interface Props {
  stats: { students: number; alerts: number; observations: number }
  riskStudents: Array<{ id: string; full_name: string; risk_level: string; class?: { name: string } | null }>
  noRecentObs?: NoRecentObsItem[]
  recentObservations: Array<{
    id: string; author_id: string; student_id: string; content: string; category: string; created_at: string; is_alert: boolean
    student?: { full_name: string; class_id?: string | null; photo_url?: string | null; class?: { name: string } | null } | null
    author?: { full_name: string } | null
    reactions?: ReactionItem[]
  }>
  userName?: string
  classes?: Array<{ id: string; name: string }>
  schoolYear?: number
  isAdmin?: boolean
  canViewAnalytics?: boolean
  classTeacherClassName?: string | null
  currentUserId?: string
  defaultClassId?: string
  newStudentsMonth?: number
  departedMonth?: number
  newObsWeek?: number
  newAlertObsWeek?: number
  aiRecommendations?: string | null
  teacherStats?: TeacherStat[]
}

export function DashboardContent({ stats, riskStudents: _r, noRecentObs = [], recentObservations, userName, classes = [], schoolYear = 2026, isAdmin = false, canViewAnalytics = false, classTeacherClassName, currentUserId, defaultClassId = '', newStudentsMonth = 0, departedMonth = 0, newObsWeek = 0, newAlertObsWeek = 0, aiRecommendations = null, teacherStats = [] }: Props) {
  const { t, locale } = useI18n()
  const [classFilter, setClassFilter] = useState(defaultClassId)
  const [search, setSearch] = useState('')
  const [observations, setObservations] = useState(recentObservations)
  const [alertsCount, setAlertsCount] = useState(stats.alerts)

  const filtered = observations.filter((obs) => {
    const matchClass = !classFilter || obs.student?.class_id === classFilter
    const matchSearch = !search || obs.student?.full_name?.toLowerCase().includes(search.toLowerCase())
    return matchClass && matchSearch
  })

  // ID последнего наблюдения текущего пользователя (список уже отсортирован по убыванию)
  const lastOwnObsId = currentUserId
    ? observations.find((o) => o.author_id === currentUserId)?.id ?? null
    : null

  async function handleDeleteObs(id: string) {
    if (!confirm(t('dash.confirmDeleteObs'))) return
    const res = await deleteObservation(id)
    if (res.error) { alert(res.error); return }
    setObservations((prev) => prev.filter((o) => o.id !== id))
  }

  async function handleDismissAlert(id: string) {
    const res = await dismissAlert(id)
    if (res.error) { alert(res.error); return }
    setObservations((prev) => prev.map((o) => o.id === id ? { ...o, is_alert: false } : o))
    setAlertsCount((prev) => Math.max(0, prev - 1))
  }

  // For class teachers: show only their class alerts; for others: all alert observations
  const alertObs = observations.filter(o =>
    o.is_alert && (!defaultClassId || o.student?.class_id === defaultClassId)
  )

  return (
    <div className="px-4 pt-4 pb-6 sm:px-8 sm:pt-5 sm:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {getGreeting(t)}{userName ? `, ${userName}` : ''}!
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {classTeacherClassName ? t('dash.classAnalytics', { name: classTeacherClassName }) : t('dash.schoolToday')}
          </p>
        </div>
        <SchoolYearBadge schoolYear={schoolYear} isAdmin={isAdmin} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 mb-5 sm:mb-7">
        <StatCard
          icon={<Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />}
          iconBg="bg-blue-50"
          label={t('dash.students')}
          value={stats.students}
          trend={newStudentsMonth > 0 ? t('dash.plusMonth', { n: newStudentsMonth }) : t('dash.noNewMonth')}
          trendColor={newStudentsMonth > 0 ? 'text-green-500' : 'text-gray-400'}
        />
        <StatCard
          icon={<ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />}
          iconBg="bg-red-50"
          label={t('dash.atRisk')}
          mobileLabel={t('dash.atRiskShort')}
          value={noRecentObs.length}
          trend={t('dash.noObs14')}
          trendColor="text-red-400"
        />
        <StatCard
          icon={<Eye className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />}
          iconBg="bg-teal-50"
          label={t('dash.observations')}
          value={stats.observations}
          trend={newObsWeek > 0 ? t('dash.plusWeek', { n: newObsWeek }) : t('dash.noNewWeek')}
          trendColor={newObsWeek > 0 ? 'text-green-500' : 'text-gray-400'}
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />}
          iconBg="bg-orange-50"
          label={t('dash.alertObs')}
          mobileLabel={t('dash.alertObsShort')}
          value={alertsCount}
          trend={newAlertObsWeek > 0 ? t('dash.plusWeek', { n: newAlertObsWeek }) : t('dash.noNewWeek')}
          trendColor={newAlertObsWeek > 0 ? 'text-orange-500' : 'text-gray-400'}
        />
      </div>

      {/* Middle: observations + AI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
        {/* Observations feed */}
        <div className={`${canViewAnalytics ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-gray-100 p-4 sm:p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">{t('dash.allObs')}</h2>
              <p className="text-xs text-gray-400">{pluralizeObs(observations.length, locale)}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('dash.searchName')}
              className="flex-1 pl-3 pr-4 py-2 text-sm rounded-lg border border-gray-100 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100"
            />
            {classes.length > 0 && (
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="flex-shrink-0 pl-2 pr-6 py-2 text-xs sm:text-sm rounded-lg border border-gray-100 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">{t('dash.classSelect')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {filtered.length > 0 ? (
              filtered.map((obs) => (
                <ObservationRow
                  key={obs.id}
                  obs={obs}
                  isLastByMe={obs.id === lastOwnObsId}
                  onDelete={handleDeleteObs}
                  currentUserId={currentUserId}
                />
              ))
            ) : (
              <EmptyObservations />
            )}
          </div>
        </div>

        {/* AI Insights — only for admin, deputy, manager */}
        {canViewAnalytics && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">{t('dash.aiMonth')}</h2>
            </div>

            {aiRecommendations ? (
              <ul className="space-y-3 flex-1">
                {parseRecommendations(aiRecommendations).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                    <p className="text-xs text-gray-600 leading-relaxed">{item}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 flex-1">{t('dash.aiSoon')}</p>
            )}

            <Link
              href="/analytics"
              className="mt-4 text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors"
            >
              {t('dash.more')}
            </Link>
          </div>
        )}
      </div>

      {/* Активность педагогов */}
      <div className="mb-4 sm:mb-5">
        <TeacherActivityCard stats={teacherStats} />
      </div>

      {/* Bottom: risk students + alert observations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <NoRecentObsCard students={noRecentObs} />

        {/* Alert observations */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-gray-900 text-sm">{t('dash.alertObs')}</h3>
              <InfoTooltip text={t('dash.alertTooltip')} />
            </div>
            <span className="text-xs text-red-500 font-medium">{alertObs.length}</span>
          </div>
          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-0.5">
            {alertObs.length > 0 ? (
              alertObs.map((obs) => (
                <div key={obs.id} className="flex items-start gap-2 bg-red-50/50 rounded-xl p-2.5 group/alert">
                  <Link href={`/students/${obs.student_id}`} className="w-7 h-7 rounded-full overflow-hidden bg-red-100 flex items-center justify-center text-xs font-semibold text-red-600 flex-shrink-0 hover:bg-red-200 transition-colors">
                    {obs.student?.photo_url
                      ? <img src={obs.student.photo_url} alt={obs.student.full_name ?? ''} className="w-full h-full object-cover" />
                      : (obs.student?.full_name ?? '??').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Link href={`/students/${obs.student_id}`} className="text-xs font-medium text-gray-900 truncate hover:text-blue-600 hover:underline transition-colors">{obs.student?.full_name ?? '—'}</Link>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[obs.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t('cat.' + obs.category)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 line-clamp-2">{obs.content}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {obs.author?.full_name ?? '—'} · {new Date(obs.created_at).toLocaleDateString(dl(locale), { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDismissAlert(obs.id)}
                      title={t('dash.dismissTitle')}
                      className="opacity-0 group-hover/alert:opacity-100 flex-shrink-0 text-[10px] text-gray-400 hover:text-green-600 hover:bg-green-50 border border-gray-200 hover:border-green-200 px-2 py-1 rounded-lg transition-all whitespace-nowrap"
                    >
                      {t('dash.dismiss')}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">{t('dash.noAlertObs')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 text-[10px] font-bold flex items-center justify-center hover:bg-gray-200 transition-colors leading-none"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-gray-900 text-white text-[11px] rounded-xl px-3 py-2 z-50 text-center shadow-lg">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon, iconBg, label, mobileLabel, value, trend, trendColor = 'text-green-500', trend2, trend2Color = 'text-red-500',
}: {
  icon: React.ReactNode; iconBg: string; label: string; mobileLabel?: string
  value: number; trend: string; trendColor?: string
  trend2?: string; trend2Color?: string
}) {
  const { locale } = useI18n()
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-5">
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
        <span className="text-xs sm:text-sm text-gray-500 leading-snug">
          {mobileLabel ? (
            <><span className="sm:hidden">{mobileLabel}</span><span className="hidden sm:inline">{label}</span></>
          ) : label}
        </span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900">{value.toLocaleString(dl(locale))}</p>
      <div className="flex items-center justify-between mt-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          <TrendingUp className={`w-3 h-3 flex-shrink-0 ${trendColor}`} />
          <span className={`text-[10px] sm:text-xs ${trendColor} truncate`}>{trend}</span>
        </div>
        {trend2 && (
          <div className="flex items-center gap-1 min-w-0 overflow-hidden ml-1">
            <TrendingDown className={`w-3 h-3 flex-shrink-0 ${trend2Color}`} />
            <span className={`text-[10px] sm:text-xs ${trend2Color} truncate`}>{trend2}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ObservationRow({ obs, isLastByMe, onDelete, currentUserId }: {
  obs: Props['recentObservations'][0]
  isLastByMe?: boolean
  onDelete?: (id: string) => void
  currentUserId?: string
}) {
  const { t, locale } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const isLong = obs.content?.length > 100
  const initials = (obs.student?.full_name ?? '??')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0 group">
      <Link href={`/students/${obs.student_id}`} className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600 hover:bg-blue-200 transition-colors">
        {obs.student?.photo_url
          ? <img src={obs.student.photo_url} alt={obs.student.full_name ?? ''} className="w-full h-full object-cover" />
          : initials}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Link href={`/students/${obs.student_id}`} className="text-xs font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors">{obs.student?.full_name ?? '—'}</Link>
          {(obs.student?.class?.name) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              {obs.student.class.name}
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[obs.category] ?? 'bg-gray-100 text-gray-600'}`}>
            {t('cat.' + obs.category)}
          </span>
          {obs.is_alert && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">{t('dash.alertChip')}</span>
          )}
        </div>
        <p className={`text-xs text-gray-500 ${!expanded && isLong ? 'line-clamp-2' : ''}`}>{obs.content}</p>
        {isLong && (
          <button onClick={() => setExpanded(p => !p)} className="text-[10px] text-blue-500 hover:text-blue-700 mt-0.5">
            {expanded ? t('dash.collapse') : t('dash.expand')}
          </button>
        )}
        <p className="text-[10px] text-gray-500 mt-0.5">
          {obs.author?.full_name ?? '—'} · {new Date(obs.created_at).toLocaleDateString(dl(locale), { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        {currentUserId && (
          <ReactionBar
            observationId={obs.id}
            currentUserId={currentUserId}
            initial={obs.reactions ?? []}
          />
        )}
      </div>
      {isLastByMe && onDelete && (
        <button
          onClick={() => onDelete(obs.id)}
          title={t('dash.deleteObsTitle')}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

const AVATAR_COLORS = [
  'bg-orange-400', 'bg-teal-500', 'bg-purple-500', 'bg-blue-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-green-500', 'bg-yellow-500',
]

function NoRecentObsCard({ students }: { students: NoRecentObsItem[] }) {
  const { t, locale } = useI18n()
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-gray-900">{t('dash.atRisk')}</h2>
          <InfoTooltip text={t('dash.atRiskTooltip')} />
        </div>
        <span className="text-xs text-red-500 font-medium">{students.length}</span>
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">{t('dash.allGotObs')}</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {students.map((s, idx) => {
            const isUrgent = s.days_since === null || s.days_since > 21
            const initials = s.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
            const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]
            const daysLabel = s.days_since === null
              ? t('dash.noObsRisk')
              : locale === 'en'
                ? `last observation ${s.days_since}d ago`
                : `последнее наблюдение ${s.days_since} ${s.days_since === 1 ? 'день' : s.days_since < 5 ? 'дня' : 'дней'} назад`

            return (
              <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors">
                <div className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.full_name}</p>
                  <p className="text-xs text-gray-400">{s.class_name} · {daysLabel}</p>
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full flex-shrink-0 ${
                  isUrgent ? 'bg-red-50 text-red-500' : 'bg-yellow-50 text-yellow-600'
                }`}>
                  {isUrgent ? t('dash.urgent') : t('dash.attention')}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Рекомендации ИИ приходят нумерованным списком «1. … 2. …» (через перевод строки
// или просто пробел). Разбиваем по номерам пунктов, а НЕ по концу предложения —
// иначе точка после «1» ломала список на «1.» + текст отдельными пунктами.
function parseRecommendations(text: string): string[] {
  const raw = text.trim()
  const numbered = raw.match(/\d+\.\s+[\s\S]*?(?=\s+\d+\.\s|$)/g)
  const items = numbered && numbered.length > 0
    ? numbered.map(s => s.replace(/^\s*\d+\.\s*/, '').trim())
    : raw.split(/\n+/).map(s => s.replace(/^[\s•*-]*\d*\.?\s*/, '').trim())
  return items.filter(s => s.length > 0)
}

function tInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
function daysAgoLabel(dateStr: string | null, t: TFn, locale: Locale) {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return t('dash.today')
  if (days === 1) return t('dash.yesterday')
  return locale === 'en' ? `${days}d ago` : `${days} дн. назад`
}

function TeacherActivityCard({ stats }: { stats: TeacherStat[] }) {
  const { t, locale } = useI18n()
  const maxObs = Math.max(...stats.map(s => s.obsCount), 1)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-gray-900">{t('dash.teacherActivity')}</h3>
          <InfoTooltip text={t('dash.teacherTooltip')} />
        </div>
        <span className="text-xs text-gray-400">{t('dash.for30days')}</span>
      </div>
      {stats.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{t('dash.noData')}</p>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {stats.map(s => (
            <div key={s.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[9px] font-bold flex-shrink-0">{tInitials(s.name)}</div>
                  <span className="text-xs font-medium text-gray-800 truncate">{s.name}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{t('role.' + s.role)}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className={`text-xs font-semibold ${s.obsCount === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{s.obsCount}</span>
                  <span className="text-[10px] text-gray-400">{daysAgoLabel(s.lastObs, t, locale)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${s.obsCount === 0 ? 'bg-gray-200' : 'bg-blue-500'}`} style={{ width: `${Math.round(s.obsCount / maxObs * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyObservations() {
  const { t } = useI18n()
  return (
    <div className="py-8 text-center">
      <Eye className="w-8 h-8 text-gray-200 mx-auto mb-2" />
      <p className="text-sm text-gray-400">{t('dash.noObsYet')}</p>
      <p className="text-xs text-gray-300 mt-0.5">{t('dash.addFirst')}</p>
    </div>
  )
}
