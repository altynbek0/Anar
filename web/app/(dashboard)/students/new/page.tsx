import { requireRole } from '@/lib/auth/require-role'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { QuestionnaireImport } from '@/components/students/QuestionnaireImport'

export default async function NewStudentPage() {
  await requireRole(['admin', 'deputy', 'class_teacher', 'manager'])
  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
        <Link href="/students" className="hover:text-gray-600">Ученики</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-700 font-medium">Добавить учеников</span>
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Добавить учеников</h1>
      <p className="text-sm text-gray-400 mb-8">
        Загрузите все три анкеты в формате Excel — профили создадутся автоматически
      </p>

      <QuestionnaireImport />
    </div>
  )
}
