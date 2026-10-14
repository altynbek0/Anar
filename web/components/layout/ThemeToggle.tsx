'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark'

export function ThemeToggle() {
  const { t } = useI18n()
  const [theme, setTheme] = useState<Theme>('light')

  // Класс на <html> ставит inline-скрипт из layout (без мерцания); здесь лишь читаем его.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  function choose(next: Theme) {
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    try { localStorage.setItem('theme', next) } catch {}
  }

  const options: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
    { value: 'light', icon: Sun, labelKey: 'theme.light' },
    { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
  ]

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      {options.map(({ value, icon: Icon, labelKey }) => (
        <button
          key={value}
          onClick={() => choose(value)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-colors',
            theme === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {t(labelKey)}
        </button>
      ))}
    </div>
  )
}
