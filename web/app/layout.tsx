import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://strideai.it.com'),
  title: {
    default: 'Anar — платформа аналитики и профиля ученика',
    template: '%s · Anar',
  },
  description:
    'Anar — AI-платформа для школ: цифровой профиль ученика, наблюдения учителей, аналитика и книга ученика.',
  applicationName: 'Anar',
  keywords: ['Anar', 'анар', 'профиль ученика', 'школьная аналитика', 'книга ученика'],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: 'https://strideai.it.com',
    siteName: 'Anar',
    title: 'Anar — платформа аналитики и профиля ученика',
    description: 'AI-платформа для школ: цифровой профиль ученика, наблюдения учителей, аналитика.',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anar — платформа аналитики ученика',
    description: 'AI-платформа для школ: профиль ученика, наблюдения, аналитика.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-inter)]">{children}</body>
    </html>
  )
}
