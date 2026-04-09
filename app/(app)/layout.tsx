// app/(app)/layout.tsx
import { redirect } from 'next/navigation'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import AppNav from '@/components/AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!member) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <AppNav member={member} />
      <main className="min-w-0 flex-1 min-h-screen bg-sand-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
