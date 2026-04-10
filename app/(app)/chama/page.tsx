// app/(app)/chama/page.tsx
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus, TrendingUp, Lock } from 'lucide-react'
import CreateChamaModal from '@/components/chama/CreateChamaModal'

type DecimalValue = Parameters<typeof decimalToNumber>[0]

type MembershipRow = {
  chama_id: string
  total_contributed: DecimalValue
  payout_received: boolean
}

type ChamaRow = {
  id: string
  name: string
  balance: DecimalValue
  status: string
  contribution_amount: DecimalValue
}

export default async function ChamaPage() {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!member) redirect('/login')

  const memberships: MembershipRow[] = await prisma.chamaMember.findMany({
    where: { member_id: member.id },
    select: {
      chama_id: true,
      total_contributed: true,
      payout_received: true,
    },
  })

  const myIds = memberships.map((membership: MembershipRow) => membership.chama_id)
  const myChamaRows: ChamaRow[] = myIds.length
    ? await prisma.chama.findMany({
        where: { id: { in: myIds } },
        select: {
          id: true,
          name: true,
          balance: true,
          status: true,
          contribution_amount: true,
          cycle_days: true,
          created_by: true,
        },
      })
    : []

  const chamas = memberships
    .map((membership: MembershipRow) => {
      const chama = myChamaRows.find((row: ChamaRow) => row.id === membership.chama_id)
      if (!chama) return null
      return {
        ...chama,
        balance: decimalToNumber(chama.balance),
        contribution_amount: decimalToNumber(chama.contribution_amount),
        total_contributed: decimalToNumber(membership.total_contributed),
        payout_received: membership.payout_received,
      }
    })
    .filter((chama): chama is NonNullable<typeof chama> => Boolean(chama))

  const openChamaRows: ChamaRow[] = await prisma.chama.findMany({
    where: {
      status: 'forming',
      ...(myIds.length ? { id: { notIn: myIds } } : {}),
    },
    take: 6,
    select: {
      id: true,
      name: true,
      balance: true,
      status: true,
      contribution_amount: true,
    },
  })

  const openChamas = openChamaRows.map((chama: ChamaRow) => ({
    ...chama,
    balance: decimalToNumber(chama.balance),
    contribution_amount: decimalToNumber(chama.contribution_amount),
  }))

  const STATUS_COLORS: Record<string, string> = {
    forming: 'bg-amber-100 text-amber-700',
    active:  'bg-green-100 text-green-700',
    payout:  'bg-blue-100 text-blue-700',
    closed:  'bg-gray-100 text-gray-500',
  }

  if (member.identity_level < 1) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="section-title">Savings Groups</h1>
          <p className="section-sub">Digital chamas — save together, grow together</p>
        </div>
        <div className="card text-center py-16">
          <Lock className="w-12 h-12 text-earth-300 mx-auto mb-3" />
          <h2 className="font-display text-xl text-ink-100 mb-2">Level 1 required</h2>
          <p className="text-sm text-earth-500">Complete one identity pillar to join savings groups.</p>
          <Link href="/dashboard" className="btn-primary inline-flex mt-4">Go to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-title">Savings Groups</h1>
          <p className="section-sub">Digital chamas — save together, grow together</p>
        </div>
        {member.identity_level >= 3 && (
          <CreateChamaModal />
        )}
      </div>

      {/* My groups */}
      {chamas.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-ink-100 mb-3">My groups ({chamas.length})</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {chamas.map((c) => (
              <Link key={c.id} href={`/chama/${c.id}`}>
                <div className="card hover:border-earth-300 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-earth-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-earth-300" />
                      </div>
                      <div>
                        <p className="font-medium text-ink-100">{c.name}</p>
                        <span className={`badge text-xs ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-earth-400">Pool balance</p>
                      <p className="font-display text-lg text-ink-100">KES {c.balance.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-earth-500 pt-3 border-t border-earth-100">
                    <span>KES {c.contribution_amount} / cycle</span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      You contributed: KES {c.total_contributed.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Discover */}
      {openChamas && openChamas.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-ink-100 mb-3">Open groups to join</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {openChamas.map((c) => (
              <Link key={c.id} href={`/chama/${c.id}`}>
                <div className="card hover:border-earth-300 transition-colors cursor-pointer border-dashed">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Users className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-ink-100">{c.name}</p>
                      <p className="text-xs text-earth-500">KES {c.contribution_amount} / cycle</p>
                    </div>
                  </div>
                  <button className="btn-secondary w-full text-xs mt-2">
                    <Plus className="w-3.5 h-3.5 inline mr-1" />Request to join
                  </button>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {chamas.length === 0 && (!openChamas || openChamas.length === 0) && (
        <div className="card text-center py-16">
          <Users className="w-12 h-12 text-earth-300 mx-auto mb-3" />
          <h2 className="font-display text-xl text-ink-100 mb-2">No groups yet</h2>
          <p className="text-sm text-earth-500 mb-4">Reach Level 3 to create your own chama, or ask a Level 3 member to invite you.</p>
        </div>
      )}
    </div>
  )
}
