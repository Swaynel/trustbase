// app/(app)/layout.tsx
import { redirect } from 'next/navigation'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import AppNav from '@/components/AppNav'
import { getProfileUrl } from '@/lib/cloudinary'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, member } = await getCurrentUserWithMember()

  if (!user || !member) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-[100dvh] bg-sand-50 text-ink-100 selection:bg-primary-600/60 selection:text-ink-50">

      <AppNav
        member={member}
        profileImageUrl={member.cloudinary_profile_id ? getProfileUrl(member.cloudinary_profile_id) : undefined}
      />

      <main className="relative flex flex-1 flex-col min-w-0 overflow-hidden md:ml-3">

        {/* Subtle depth gradient behind content header area */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary-500/12 to-transparent"
        />

        {/* Scrollable region */}
        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
            {children}
          </div>
        </div>

      </main>
    </div>
  )
}
