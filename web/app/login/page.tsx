'use client'

import { useActionState } from 'react'
import { login } from './actions'
import { Eye, EyeOff, ArrowRight, BookOpen, TrendingUp, Bell, Users, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Книга ученика',
    description: 'Полный профиль каждого ученика: успеваемость, активности и наблюдения в одном месте.',
  },
  {
    icon: Bell,
    title: 'Тревожные наблюдения',
    description: 'Мгновенные уведомления о проблемных ситуациях — ни один сигнал не останется без внимания.',
  },
  {
    icon: TrendingUp,
    title: 'Аналитика и риски',
    description: 'Выявляйте учеников в зоне риска до того, как ситуация станет критической.',
  },
  {
    icon: Users,
    title: 'Командная работа',
    description: 'Учителя, классные руководители и администрация работают в единой системе.',
  },
  {
    icon: ShieldCheck,
    title: 'Безопасность данных',
    description: 'Разграничение прав доступа и защита персональных данных учеников.',
  },
]

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT: hero panel ── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-14"
        style={{ background: 'linear-gradient(145deg, #06091A 0%, #0C1535 50%, #080D20 100%)' }}
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-18%', left: '-12%',
            width: 700, height: 700,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: '25%', right: '-22%',
            width: 560, height: 560,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '-8%', left: '15%',
            width: 420, height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 65%)',
          }}
        />

        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* ── Top: logo ── */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center border"
            style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.14)' }}
          >
            <Image src="/icon.png" width={20} height={20} alt="Anar" />
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">Anar</span>
        </div>

        {/* ── Middle: headline + stats ── */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-16">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full mb-7 text-xs font-medium"
            style={{
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.30)',
              color: '#93C5FD',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            Платформа нового поколения
          </div>

          {/* Headline */}
          <h1 className="text-white font-bold leading-[1.13] mb-5" style={{ fontSize: 42 }}>
            Умное управление<br />
            <span
              style={{
                background: 'linear-gradient(130deg, #60A5FA 0%, #A78BFA 60%, #818CF8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              профилем ученика
            </span>
          </h1>
          <p className="text-slate-400 text-[15px] leading-relaxed max-w-[360px] mb-12">
            Наблюдайте за каждым учеником, выявляйте риски и выстраивайте индивидуальные траектории развития — в одной платформе.
          </p>

          {/* Features list */}
          <div className="space-y-3.5 max-w-[420px]">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-4">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}
                >
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold mb-0.5">{title}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── RIGHT: form panel ── */}
      <div className="flex-1 flex items-center justify-center px-8 py-12 bg-[#F8F9FC]">
        <div className="w-full max-w-[360px]">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-center mb-6">
              <Image src="/icon.png" width={56} height={56} alt="Anar" />
            </div>
            <h2 className="text-[26px] font-bold text-gray-900 tracking-tight mb-2 text-center">
              Добро пожаловать
            </h2>
            <p className="text-gray-500 text-sm text-center">Войдите в свой аккаунт, чтобы продолжить</p>
          </div>

          <form action={action} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                name="email"
                type="email"
                placeholder="name@school.com"
                required
                autoComplete="email"
                className="w-full px-4 py-[11px] rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-300 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Пароль
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-[11px] pr-11 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-300 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {state?.error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {state.error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={pending}
              className="w-full py-[11px] rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: pending
                  ? '#2563EB'
                  : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                boxShadow: '0 4px 24px rgba(37,99,235,0.30), 0 1px 3px rgba(37,99,235,0.20)',
              }}
            >
              {pending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Входим...
                </>
              ) : (
                <>
                  Войти
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 space-y-3">
            <p className="text-center text-xs text-gray-400">
              Нужна помощь? Обратитесь к администратору
            </p>
            <p className="text-center text-xs text-gray-300">
              © {new Date().getFullYear()} Anar · Все права защищены
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
