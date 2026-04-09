'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  ShoppingBag,
  UserCircle,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const LEVEL_NAMES = ['Observer', 'Participant', 'Member', 'Trusted Member', 'Community Anchor']
const LEVEL_COLORS = ['bg-gray-400', 'bg-amber-500', 'bg-orange-500', 'bg-forest-500', 'bg-earth-600']

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', minLevel: 0 },
  { href: '/chama', icon: Users, label: 'Savings', minLevel: 1 },
  { href: '/loans', icon: Landmark, label: 'Loans', minLevel: 2 },
  { href: '/marketplace', icon: ShoppingBag, label: 'Marketplace', minLevel: 2 },
  { href: '/governance', icon: Vote, label: 'Governance', minLevel: 1 },
  { href: '/transfer', icon: ArrowLeftRight, label: 'Transfer', minLevel: 2 },
  { href: '/profile', icon: UserCircle, label: 'Profile', minLevel: 0 },
]

interface Member {
  id: string
  display_name: string
  identity_level: number
  role: string
  cloudinary_profile_id?: string
}

function NavContent({
  member,
  level,
  pathname,
  onNavigate,
  onSignOut,
}: {
  member: Member
  level: number
  pathname: string
  onNavigate: () => void
  onSignOut: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-earth-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-earth-600 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="10" r="5" fill="white" opacity="0.9" />
              <circle cx="8" cy="22" r="4" fill="white" opacity="0.7" />
              <circle cx="24" cy="22" r="4" fill="white" opacity="0.7" />
              <line x1="16" y1="15" x2="8" y2="18" stroke="white" strokeWidth="1.5" opacity="0.5" />
              <line x1="16" y1="15" x2="24" y2="18" stroke="white" strokeWidth="1.5" opacity="0.5" />
            </svg>
          </div>
          <span className="font-display font-bold text-ink-900 text-lg">TrustBase</span>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-earth-100">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${LEVEL_COLORS[level]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
            {(member.display_name || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-ink-900 text-sm truncate">{member.display_name || 'Member'}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium level-${level}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                {LEVEL_NAMES[level]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          const locked = level < item.minLevel

          return (
            <Link
              key={item.href}
              href={locked ? '#' : item.href}
              onClick={onNavigate}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${active
                  ? 'bg-earth-600 text-white shadow-sm'
                  : locked
                  ? 'text-earth-300 cursor-not-allowed'
                  : 'text-ink-800 hover:bg-earth-100'
                }
              `}
            >
              <item.icon size={17} className={active ? 'text-white' : locked ? 'text-earth-300' : 'text-earth-600'} />
              {item.label}
              {locked && <span className="ml-auto text-[10px] text-earth-300 font-mono">Lv{item.minLevel}</span>}
            </Link>
          )
        })}

        {member.role === 'operator' && (
          <Link href="/operator/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-600 hover:bg-forest-50 transition-all">
            <Shield size={17} className="text-forest-600" />
            Operator Panel
          </Link>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-earth-100">
        <button
          onClick={onSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-earth-600 hover:bg-earth-50 w-full transition-all"
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function AppNav({ member }: { member: Member }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const level = member.identity_level

  return (
    <>
      <aside className="hidden md:flex md:sticky md:top-0 h-screen w-64 shrink-0 flex-col bg-white border-r border-earth-200">
        <NavContent
          member={member}
          level={level}
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
          onSignOut={signOut}
        />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-earth-200 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-earth-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="10" r="5" fill="white" />
              <circle cx="8" cy="22" r="4" fill="white" opacity="0.7" />
              <circle cx="24" cy="22" r="4" fill="white" opacity="0.7" />
            </svg>
          </div>
          <span className="font-display font-bold text-ink-900">TrustBase</span>
        </div>
        <button onClick={() => setMobileOpen((open) => !open)} className="p-2 rounded-lg hover:bg-earth-50">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl">
            <NavContent
              member={member}
              level={level}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              onSignOut={signOut}
            />
          </aside>
        </div>
      )}

      <div className="md:hidden h-14" />
    </>
  )
}
