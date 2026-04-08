// app/(app)/dashboard/page.tsx
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp, Users, ShoppingBag,
  Landmark, Vote, ArrowRight, Zap, Star
} from 'lucide-react'
import IdentityCard from '@/components/identity/IdentityCard'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import RecentChamas from '@/components/dashboard/RecentChamas'

type DecimalValue = Parameters<typeof decimalToNumber>[0]

type TransactionRow = {
  id: string
  type: string
  amount: DecimalValue
  direction: string
  created_at: Date
  metadata: unknown
}

type ChamaMembershipRow = {
  chama_id: string
}

type ChamaRow = {
  id: string
  name: string
  balance: DecimalValue
  status: string
  contribution_amount: DecimalValue
}

type OpenVoteRow = {
  id: string
  proposal: string
  window_closes_at: Date
}

export default async function DashboardPage() {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!member) redirect('/login')

  const [pillars, transactionRowsRaw, chamaMembershipsRaw, openVotesRaw] = await Promise.all([
    prisma.identityPillar.findFirst({
      where: { member_id: member.id },
    }),
    prisma.transaction.findMany({
      where: { member_id: member.id },
      orderBy: { created_at: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        amount: true,
        direction: true,
        created_at: true,
        metadata: true,
      },
    }),
    prisma.chamaMember.findMany({
      where: { member_id: member.id },
      take: 3,
      select: { chama_id: true },
    }),
    prisma.vote.findMany({
      where: {
        status: 'open',
        window_closes_at: { gt: new Date() },
      },
      take: 1,
      orderBy: { window_closes_at: 'asc' },
      select: {
        id: true,
        proposal: true,
        window_closes_at: true,
      },
    }),
  ])

  const transactionRows: TransactionRow[] = transactionRowsRaw
  const chamaMemberships: ChamaMembershipRow[] = chamaMembershipsRaw
  const openVotes: OpenVoteRow[] = openVotesRaw

  const transactions = transactionRows.map((transaction: TransactionRow) => ({
    ...transaction,
    amount: decimalToNumber(transaction.amount),
    created_at: transaction.created_at.toISOString(),
  }))

  const serializedPillars = pillars
    ? {
        ...pillars,
        pillar_1_score: decimalToNumber(pillars.pillar_1_score),
        pillar_2_score: decimalToNumber(pillars.pillar_2_score),
        pillar_3_score: decimalToNumber(pillars.pillar_3_score),
        p2_days_present: pillars.p2_days_present ?? 0,
        p3_threads: pillars.p3_threads ?? 0,
      }
    : null

  const chamaIds = chamaMemberships.map((membership: ChamaMembershipRow) => membership.chama_id)
  const chamaRows: ChamaRow[] = chamaIds.length
    ? await prisma.chama.findMany({
        where: { id: { in: chamaIds } },
        select: {
          id: true,
          name: true,
          balance: true,
          status: true,
          contribution_amount: true,
        },
      })
    : []

  const chamas = chamaIds
    .map((id: string) => chamaRows.find((chama: ChamaRow) => chama.id === id))
    .filter((chama): chama is NonNullable<typeof chama> => Boolean(chama))
    .map((chama: ChamaRow) => ({
      ...chama,
      balance: decimalToNumber(chama.balance),
      contribution_amount: decimalToNumber(chama.contribution_amount),
    }))

  const now = new Date()
  const LEVEL_NAMES = ['Observer', 'Participant', 'Member', 'Trusted Member', 'Community Anchor']
  const daysSince = Math.floor((now.getTime() - new Date(member.created_at).getTime()) / 86400000)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="fade-in-1">
        <h1 className="section-title">
          Welcome back, {member.display_name?.split(' ')[0] || 'friend'} 👋
        </h1>
        <p className="section-sub">
          {LEVEL_NAMES[member.identity_level]} · Day {daysSince} on TrustBase
        </p>
      </div>

      {/* Identity card */}
      <div className="fade-in-2">
        <IdentityCard member={member} pillars={serializedPillars} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 fade-in-3">
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Reputation"
          value={`${Math.round(member.reputation_score)}/100`}
          color="bg-forest-400"
        />
        <StatCard
          icon={<Landmark className="w-5 h-5" />}
          label="Balance"
          value={`KES ${member.internal_balance.toLocaleString()}`}
          color="bg-earth-500"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Savings groups"
          value={String(chamas.length)}
          color="bg-amber-500"
        />
        <StatCard
          icon={<Star className="w-5 h-5" />}
          label="Level"
          value={`${member.identity_level} / 4`}
          color="bg-earth-700"
        />
      </div>

      {/* Quick actions */}
      <div className="fade-in-3">
        <h2 className="font-display text-lg text-ink-900 mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction href="/chama" icon={<Users className="w-5 h-5" />} label="Savings" locked={member.identity_level < 1} />
          <QuickAction href="/loans" icon={<Landmark className="w-5 h-5" />} label="Loans" locked={member.identity_level < 2} />
          <QuickAction href="/marketplace" icon={<ShoppingBag className="w-5 h-5" />} label="Marketplace" locked={member.identity_level < 2} />
          <QuickAction href="/governance" icon={<Vote className="w-5 h-5" />} label="Vote" locked={member.identity_level < 1} />
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid md:grid-cols-2 gap-6 fade-in-4">
        {/* Recent activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-ink-900">Recent activity</h2>
            <Link href="/profile" className="text-xs text-earth-500 hover:text-earth-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <ActivityFeed transactions={transactions} />
        </div>

        {/* Savings groups */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-ink-900">Your savings groups</h2>
            <Link href="/chama" className="text-xs text-earth-500 hover:text-earth-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <RecentChamas chamas={chamas} memberLevel={member.identity_level} />
        </div>
      </div>

      {/* Open vote banner */}
      {openVotes.length > 0 && (
        <Link href="/governance" className="fade-in-5">
          <div className="card border-earth-300 bg-earth-50 flex items-center gap-4 hover:bg-earth-100 transition-colors">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-earth-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-900">Community vote open</p>
              <p className="text-xs text-earth-600 truncate">{openVotes[0].proposal}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-earth-500 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* USSD reminder */}
      <div className="card bg-ink-900 text-white fade-in-5">
        <div className="flex items-start gap-4">
          <div className="text-2xl">📱</div>
          <div>
            <p className="font-medium text-sm mb-1">Access TrustBase on any phone</p>
            <p className="text-xs text-earth-200 leading-relaxed">
              Dial <span className="font-mono text-earth-300">*483*00#</span> for identity status &nbsp;·&nbsp;
              <span className="font-mono text-earth-300">*483*BAL#</span> for savings balance &nbsp;·&nbsp;
              SMS <span className="font-mono text-earth-300">HELP</span> for a guide
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string
}) {
  return (
    <div className="card p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${color} text-white mb-3`}>
        {icon}
      </div>
      <p className="text-xs text-earth-500 mb-0.5">{label}</p>
      <p className="font-display text-lg text-ink-900">{value}</p>
    </div>
  )
}

function QuickAction({ href, icon, label, locked }: {
  href: string; icon: React.ReactNode; label: string; locked: boolean
}) {
  if (locked) {
    return (
      <div className="card p-4 opacity-50 cursor-not-allowed flex flex-col items-center gap-2 text-center">
        <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
          {icon}
        </div>
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs text-gray-400">🔒 Locked</span>
      </div>
    )
  }
  return (
    <Link href={href} className="card p-4 flex flex-col items-center gap-2 text-center hover:bg-earth-50 hover:border-earth-300 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-earth-100 flex items-center justify-center text-earth-600">
        {icon}
      </div>
      <span className="text-xs font-medium text-ink-800">{label}</span>
    </Link>
  )
}
