import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { StudentBookClient } from '@/components/pdf/StudentBookClient'

export default async function StudentBookPage() {
  await requireRole(['admin', 'deputy', 'teacher', 'class_teacher', 'psychologist', 'nurse', 'manager'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users').select('school_id').eq('id', user!.id).single()

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', profile?.school_id ?? '')
    .order('name')

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, class_id, photo_url')
    .eq('school_id', profile?.school_id ?? '')
    .eq('status', 'active')
    .order('full_name')

  return (
    <div className="p-4 sm:p-8">
      <StudentBookClient classes={classes ?? []} students={students ?? []} />
    </div>
  )
}
