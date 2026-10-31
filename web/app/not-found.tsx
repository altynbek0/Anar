import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-gray-50">
      <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Страница не найдена</h2>
      <p className="text-sm text-gray-400 mb-6">Такой страницы не существует или она была удалена.</p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-[#2563EB] text-white text-sm font-medium rounded-xl hover:bg-[#1D4ED8] transition-colors"
      >
        На главную
      </Link>
    </div>
  )
}
