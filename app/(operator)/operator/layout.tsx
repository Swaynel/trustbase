// app/(operator)/operator/layout.tsx
import { redirect } from 'next/navigation'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!member || !['operator', 'admin'].includes(member.role)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
