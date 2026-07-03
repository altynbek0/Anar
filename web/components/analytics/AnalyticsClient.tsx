'use client'

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Info } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DepartureReason { name: string; value: number; color: string }
interface TrendDay { label: string; total: number; alerts: number }
interface ClassStat { name: string; studentCount: number; obsCount: number; alertCount: number; riskCount: number; noObsCount: number }
interface AiReport {
  climate: string | null; at_risk_classes: string | null
  trends: string | null; recommendations: string | null
  month: string; generated_at: string
}

// ── Component ─────────────────────────────────────────────────────────────────
interface ParentGoal { name: string; value: number }

export function AnalyticsClient({
  totalStudents, riskCount, totalObservations, alertObservations,
  departureReasons, departedTotal, schoolYear,
  trendData, classStats, aiReport, parentGoals = [],
}: {
  totalStudents: number; riskCount: number; totalObservations: number; alertObservations: number
  departureReasons: DepartureReason[]; departedTotal: number; schoolYear: number
  trendData: TrendDay[]
  classStats: ClassStat[]
  aiReport: AiReport | null
  parentGoals?: ParentGoal[]
}) {
  const reasonsTotal = departureReasons.reduce((sum, r) => sum + r.value, 0)

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Всего учеников', value: totalStudents, color: 'text-blue-600' },
          { label: 'В зоне риска', value: riskCount, color: 'text-red-600' },
          { label: 'Наблюдений', value: totalObservations, color: 'text-teal-600' },
          { label: 'Тревожных наблюдений', value: alertObservations, color: 'text-orange-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-5">
            <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Row: Observation trend + Departure reasons ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

        {/* Активность наблюдений */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Активность наблюдений</h3>
            <span className="text-xs text-gray-400">за 30 дней</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9CA3AF' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [v, name === 'total' ? 'Всего' : 'Тревожных']}
              />
              <Area type="monotone" dataKey="total" fill="#DBEAFE" stroke="#3B82F6" strokeWidth={2} dot={false} name="total" />
              <Line type="monotone" dataKey="alerts" stroke="#EF4444" strokeWidth={2} dot={false} name="alerts" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 ml-4">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-blue-500" /><span className="text-[10px] text-gray-400">Наблюдения</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-red-500" /><span className="text-[10px] text-gray-400">Тревожные</span></div>
          </div>
        </div>

        {/* Причины ухода */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Причины ухода</h3>
            {departedTotal > 0 && <span className="text-xs text-gray-400">{departedTotal} уч.</span>}
          </div>
          {departureReasons.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-10">Уходов ещё не было</p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <PieChart width={120} height={120}>
                <Pie data={departureReasons} cx={60} cy={60} innerRadius={28} outerRadius={50} dataKey="value" stroke="none">
                  {departureReasons.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => [`${v} уч. (${Math.round(v / reasonsTotal * 100)}%)`, '']} />
              </PieChart>
              <div className="w-full space-y-1.5">
                {departureReasons.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-gray-700 flex-1 truncate">{d.name}</span>
                    <span className="text-xs font-semibold text-gray-900">{d.value}</span>
                    <span className="text-[10px] text-gray-400">({Math.round(d.value / reasonsTotal * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Сравнение классов + Цели родителей ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

        {/* Сравнение классов */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Сравнение классов</h3>
            <span className="text-xs text-gray-400">за 30 дней</span>
          </div>
          {classStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Нет данных по классам</p>
          ) : (
            <div className="max-h-64 overflow-y-auto overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr className="bg-gray-50/90 backdrop-blur-sm">
                    {['Класс', 'Уч.', 'Набл.', 'Трев.', 'Риск'].map((h) => (
                      <th key={h} className="text-left text-[11px] font-medium text-gray-400 px-3 py-2.5 first:pl-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classStats.map((cls) => (
                    <tr key={cls.name} className="border-t border-gray-50 hover:bg-gray-50/40">
                      <td className="px-3 py-2.5 pl-4">
                        <span className="text-xs font-semibold text-gray-900">{cls.name}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{cls.studentCount}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn('text-xs font-medium', cls.obsCount === 0 ? 'text-gray-300' : 'text-gray-700')}>{cls.obsCount}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {cls.alertCount > 0
                          ? <span className="text-xs font-semibold text-red-500">{cls.alertCount}</span>
                          : <span className="text-xs text-gray-200">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {cls.noObsCount > 0
                          ? <span className="inline-flex items-center text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{cls.noObsCount}</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Цели родителей */}
        {parentGoals.length > 0 && (() => {
        const GOAL_COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899','#6366F1','#14B8A6','#F97316','#84CC16','#A855F7']
        const goalsTotal = parentGoals.reduce((s, g) => s + g.value, 0)
        const goalsWithColor = parentGoals.map((g, i) => ({ ...g, color: GOAL_COLORS[i % GOAL_COLORS.length] }))
        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Цели родителей</h3>
              <span className="text-xs text-gray-400">{goalsTotal} ответов</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="flex-shrink-0">
                <PieChart width={180} height={180}>
                  <Pie data={goalsWithColor} cx={90} cy={90} innerRadius={44} outerRadius={80} dataKey="value" stroke="none">
                    {goalsWithColor.map((g, i) => <Cell key={i} fill={g.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [`${v} уч. (${Math.round(v / goalsTotal * 100)}%)`, '']}
                  />
                </PieChart>
              </div>
              <div className="w-full sm:flex-1 grid grid-cols-1 gap-y-2">
                {goalsWithColor.map((g) => (
                  <div key={g.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                    <span className="text-xs text-gray-700 flex-1 truncate">{g.name}</span>
                    <span className="text-xs font-semibold text-gray-900 flex-shrink-0">{g.value}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 w-8 text-right">{Math.round(g.value / goalsTotal * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
      </div>

      {/* ── AI school report ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <Image src="/icon.png" alt="Stride" width={32} height={32} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
          <div>
            <h2 className="text-base font-bold text-gray-900">ИИ-анализ школы</h2>
            {aiReport
              ? <p className="text-xs text-gray-400 mt-0.5">
                  За {new Date(aiReport.month).toLocaleString('ru-RU', { month: 'long', year: 'numeric' })} ·
                  Обновлено {new Date(aiReport.generated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                </p>
              : <p className="text-xs text-gray-400 mt-0.5">Обновляется 1-го числа каждого месяца</p>
            }
          </div>
        </div>

        {!aiReport ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center">
            <p className="text-sm text-gray-400">Отчёт появится 1-го числа следующего месяца</p>
            <p className="text-xs text-gray-300 mt-1">AI проанализирует наблюдения за прошлый месяц автоматически</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'climate',         label: 'Общий климат',           icon: '🌤️', bg: 'bg-blue-50',   border: 'border-blue-100'   },
              { key: 'at_risk_classes', label: 'Классы под вниманием',   icon: '⚠️', bg: 'bg-orange-50', border: 'border-orange-100' },
              { key: 'trends',          label: 'Тренды месяца',          icon: '📈', bg: 'bg-purple-50', border: 'border-purple-100' },
              { key: 'recommendations', label: 'Рекомендации директору', icon: '💡', bg: 'bg-green-50',  border: 'border-green-100'  },
            ].map(({ key, label, icon, bg, border }) => (
              <div key={key} className={cn('rounded-2xl border p-5', bg, border)}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{icon}</span>
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                  {aiReport[key as keyof AiReport] as string ?? 'Нет данных'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 text-xs text-gray-400 pt-4 border-t border-gray-50">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>AI анализирует тревожные наблюдения и статистику за прошлый месяц. Решения принимаются педагогами с учётом контекста.</span>
        </div>
      </div>

    </div>
  )
}
