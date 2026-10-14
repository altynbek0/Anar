'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  UserCog,
  BookOpen,
  BarChart2,
  PlusCircle,
  LogOut,
  Camera,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { uploadSchoolLogo } from '@/app/actions/school'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from './LanguageToggle'

type Role = 'admin' | 'deputy' | 'teacher' | 'class_teacher' | 'psychologist' | 'nurse' | 'security' | 'manager'

const NAV_ITEMS: { labelKey: string; href: string; icon: React.ElementType; roles: Role[] }[] = [
  { labelKey: 'nav.home',           href: '/',                  icon: LayoutDashboard, roles: ['admin','deputy','teacher','class_teacher','psychologist','nurse','security','manager'] },
  { labelKey: 'nav.students',       href: '/students',           icon: Users,           roles: ['admin','deputy','teacher','class_teacher','psychologist','nurse','security','manager'] },
  { labelKey: 'nav.staff',          href: '/staff',              icon: UserCog,         roles: ['admin'] },
  { labelKey: 'nav.book',           href: '/student-book',       icon: BookOpen,        roles: ['admin','deputy','teacher','class_teacher','psychologist','nurse','manager'] },
  { labelKey: 'nav.analytics',      href: '/analytics',          icon: BarChart2,       roles: ['admin','deputy','manager'] },
  { labelKey: 'nav.addObservation', href: '/observations/new',   icon: PlusCircle,      roles: ['admin','deputy','teacher','class_teacher','psychologist','nurse','security','manager'] },
]

interface SidebarProps {
  userName?: string
  userRoleKey?: string
  schoolName?: string
  schoolLogoUrl?: string | null
  isAdmin?: boolean
}

export function Sidebar({ userName = 'Пользователь', userRoleKey = '', schoolName = 'Anar', schoolLogoUrl, isAdmin = false }: SidebarProps) {
  const { t } = useI18n()
  const visibleItems = NAV_ITEMS.filter(item =>
    !userRoleKey || item.roles.includes(userRoleKey as Role)
  )
  const pathname = usePathname()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(schoolLogoUrl ?? null)
  const [uploading, setUploading] = useState(false)

  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('logo', file)
    const result = await uploadSchoolLogo(formData)
    if (result.url) {
      setLogoUrl(result.url + '?t=' + Date.now())
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <aside className="w-full h-full bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="px-5 pt-5 pb-5 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-3 group/logo">
          {/* School logo / icon */}
          <div className="relative flex-shrink-0 group">
            <div
              className={cn(
                'w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center',
                logoUrl ? '' : 'bg-[#2563EB]'
              )}
            >
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={schoolName}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.5} />
              )}
            </div>
            {isAdmin && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click() }}
                disabled={uploading}
                title="Сменить логотип школы"
                className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>

          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-base leading-tight group-hover/logo:text-[#2563EB] transition-colors">Anar</p>
            <p className="text-[11px] text-gray-400 truncate leading-tight mt-0.5">{schoolName}</p>
          </div>
        </Link>

        {isAdmin && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        )}
      </div>

      {/* User */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#2563EB] text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">
            {initials || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-[11px] text-gray-400 truncate">{userRoleKey ? t('role.' + userRoleKey) : ''}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map(({ labelKey, href, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-[#EFF6FF] text-[#2563EB] font-medium'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-[#2563EB]' : 'text-gray-400')} />
              {t(labelKey)}
            </Link>
          )
        })}
      </nav>

      {/* Language + Logout */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-2">
        <LanguageToggle />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all w-full group"
        >
          <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
          {t('common.logout')}
        </button>
      </div>
    </aside>
  )
}
