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
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="fade-in-1 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink-900 tracking-tight">
            Hello, {member.display_name?.split(' ')[0] || 'friend'} <span className="animate-pulse-soft">👋</span>
          </h1>
          <p className="text-earth-500 font-medium mt-1">
            {LEVEL_NAMES[member.identity_level]} <span className="mx-2 text-earth-200">|</span> Day {daysSince} on TrustBase
          </p>
        </div>

        <div className="hidden sm:block text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-earth-300">Current Status</p>
          <p className="text-sm font-mono text-earth-500">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="fade-in-2 relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-earth-200 to-sand-200 rounded-[32px] blur-xl opacity-20 pointer-events-none" />
        <IdentityCard member={member} pillars={serializedPillars} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-in-3">
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Reputation"
          value={Math.round(member.reputation_score)}
          suffix="/100"
          color="bg-forest-500"
        />
        <StatCard
          icon={<Landmark className="w-4 h-4" />}
          label="Internal Balance"
          value={member.internal_balance.toLocaleString()}
          prefix="KES "
          color="bg-earth-600"
        />
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Active Groups"
          value={chamas.length}
          color="bg-amber-600"
        />
        <StatCard
          icon={<Star className="w-4 h-4" />}
          label="Identity Level"
          value={member.identity_level}
          suffix="/ 4"
          color="bg-ink-800"
        />
      </div>

      <div className="fade-in-3">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-display text-xl text-ink-900">Services</h2>
          <div className="h-px flex-1 bg-earth-100" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction href="/chama" icon={<Users />} label="Savings" locked={member.identity_level < 1} />
          <QuickAction href="/loans" icon={<Landmark />} label="Loans" locked={member.identity_level < 2} />
          <QuickAction href="/marketplace" icon={<ShoppingBag />} label="Market" locked={member.identity_level < 2} />
          <QuickAction href="/governance" icon={<Vote />} label="Vote" locked={member.identity_level < 1} />
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-8 fade-in-4">
        <div className="lg:col-span-3 space-y-8">
          <div className="card group overflow-hidden">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="font-display text-xl text-ink-900">Recent Activity</h2>
              <Link href="/profile" className="btn-ghost !py-1.5 !px-3 text-xs flex items-center gap-1.5 border border-earth-100">
                Details <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-6 pt-2">
              <ActivityFeed transactions={transactions} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card bg-sand-50/50 border-dashed border-2">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="font-display text-xl text-ink-900">My Chamas</h2>
              <Link href="/chama" className="text-xs font-bold text-earth-500 uppercase tracking-tight hover:text-earth-700">Manage</Link>
            </div>
            <div className="p-6 pt-2">
              <RecentChamas chamas={chamas} memberLevel={member.identity_level} />
            </div>
          </div>

          {openVotes.length > 0 && (
            <Link href="/governance" className="block group">
              <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 flex items-center gap-4 transition-all group-hover:shadow-lg group-hover:-translate-y-1">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-200 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Active Vote</p>
                  <p className="text-sm font-medium text-ink-900 line-clamp-1">{openVotes[0].proposal}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )}

          <div className="rounded-[32px] bg-ink-900 text-white p-8 relative overflow-hidden shadow-2xl shadow-ink-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-earth-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-lg backdrop-blur-md">📱</div>
                <h4 className="font-display text-lg">Offline Access</h4>
              </div>
              <p className="text-sm text-ink-200 leading-relaxed">
                No data? No problem. Use our secure USSD gateway to manage your trust score.
              </p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 font-mono text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-ink-400">Portal</span>
                  <span className="text-earth-300">*483*00#</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">Balance</span>
                  <span className="text-earth-300">*483*BAL#</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color, prefix, suffix }: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  prefix?: string
  suffix?: string
}) {
  return (
    <div className="card p-5 group hover:border-earth-400 transition-colors">
      <div className={`w-8 h-8 rounded-lg ${color} text-white flex items-center justify-center mb-4 shadow-inner`}>
        {icon}
      </div>
      <p className="text-[11px] font-bold text-earth-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-1">
        {prefix && <span className="text-xs font-bold text-earth-300">{prefix}</span>}
        <p className="font-display text-2xl text-ink-900">{value}</p>
        {suffix && <span className="text-xs font-medium text-earth-400">{suffix}</span>}
      </div>
    </div>
  )
}

function QuickAction({ href, icon, label, locked }: {
  href: string; icon: React.ReactNode; label: string; locked: boolean
}) {
  const content = (
    <>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
        locked ? 'bg-earth-50 text-earth-200' : 'bg-earth-100 text-earth-600 group-hover:bg-earth-600 group-hover:text-white shadow-sm'
      }`}>
        {icon}
      </div>
      <span className={`text-xs font-bold uppercase tracking-tight ${locked ? 'text-earth-300' : 'text-ink-800'}`}>
        {label}
      </span>
      {locked && <span className="absolute top-2 right-2 text-[10px]">🔒</span>}
    </>
  )

  if (locked) return (
    <div className="card p-5 opacity-60 flex flex-col items-center gap-3 relative overflow-hidden bg-sand-50/30">
      {content}
    </div>
  )

  return (
    <Link href={href} className="card p-5 flex flex-col items-center gap-3 group transition-all hover:border-earth-400 hover:shadow-lg hover:-translate-y-1 bg-white relative">
      {content}
    </Link>
  )
}
