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
  if (!user || !member) redirect('/login')

  const [pillars, transactionRowsRaw, chamaMembershipsRaw, openVotesRaw] = await Promise.all([
    prisma.identityPillar.findFirst({ where: { member_id: member.id } }),
    prisma.transaction.findMany({
      where: { member_id: member.id },
      orderBy: { created_at: 'desc' },
      take: 5,
      select: { id: true, type: true, amount: true, direction: true, created_at: true, metadata: true },
    }),
    prisma.chamaMember.findMany({
      where: { member_id: member.id },
      take: 3,
      select: { chama_id: true },
    }),
    prisma.vote.findMany({
      where: { status: 'open', window_closes_at: { gt: new Date() } },
      take: 1,
      orderBy: { window_closes_at: 'asc' },
      select: { id: true, proposal: true, window_closes_at: true },
    }),
  ])

  const transactionRows: TransactionRow[] = transactionRowsRaw
  const chamaMemberships: ChamaMembershipRow[] = chamaMembershipsRaw
  const openVotes: OpenVoteRow[] = openVotesRaw

  const transactions = transactionRows.map((tx: TransactionRow) => ({
    ...tx,
    amount: decimalToNumber(tx.amount),
    created_at: tx.created_at.toISOString(),
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

  const chamaIds = chamaMemberships.map((m: ChamaMembershipRow) => m.chama_id)
  const chamaRows: ChamaRow[] = chamaIds.length
    ? await prisma.chama.findMany({
        where: { id: { in: chamaIds } },
        select: { id: true, name: true, balance: true, status: true, contribution_amount: true },
      })
    : []

  const chamas = chamaIds
    .map((id: string) => chamaRows.find((c: ChamaRow) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c: ChamaRow) => ({
      ...c,
      balance: decimalToNumber(c.balance),
      contribution_amount: decimalToNumber(c.contribution_amount),
    }))

  const LEVEL_NAMES = ['Observer', 'Participant', 'Member', 'Trusted Member', 'Community Anchor']
  const daysSince = Math.floor((Date.now() - new Date(member.created_at).getTime()) / 86_400_000)

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">

      {/* Header */}
      <div className="fade-in flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink-900 tracking-tight">
            Hello, {member.display_name?.split(' ')[0] || 'friend'} 👋
          </h1>
          <p className="text-earth-500 font-medium mt-1 text-sm">
            {LEVEL_NAMES[member.identity_level]}
            <span className="mx-2 text-earth-200">·</span>
            Day {daysSince} on TrustBase
          </p>
        </div>
        <p className="hidden sm:block text-sm font-mono text-earth-400 pb-0.5">
          {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Identity card */}
      <div className="fade-in-1">
        <IdentityCard member={member} pillars={serializedPillars} />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 fade-in-2">
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Reputation"       value={Math.round(member.reputation_score)} suffix="/100"  color="bg-forest-500" />
        <StatCard icon={<Landmark     className="w-4 h-4" />} label="Balance"         value={member.internal_balance.toLocaleString()} prefix="KES " color="bg-earth-600" />
        <StatCard icon={<Users        className="w-4 h-4" />} label="Active Groups"   value={chamas.length}                         color="bg-amber-600" />
        <StatCard icon={<Star         className="w-4 h-4" />} label="Identity Level"  value={member.identity_level} suffix="/ 4"   color="bg-ink-800" />
      </div>

      {/* Services */}
      <div className="fade-in-2">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-display text-lg text-ink-900">Services</h2>
          <div className="h-px flex-1 bg-earth-100" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction href="/chama"      icon={<Users />}       label="Savings"    locked={member.identity_level < 1} />
          <QuickAction href="/loans"      icon={<Landmark />}    label="Loans"      locked={member.identity_level < 2} />
          <QuickAction href="/marketplace" icon={<ShoppingBag />} label="Market"    locked={member.identity_level < 2} />
          <QuickAction href="/governance" icon={<Vote />}        label="Vote"       locked={member.identity_level < 1} />
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-5 gap-6 fade-in-3">

        {/* Activity feed */}
        <div className="lg:col-span-3">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-earth-100">
              <h2 className="font-display text-lg text-ink-900">Recent Activity</h2>
              <Link
                href="/profile"
                className="flex items-center gap-1.5 text-xs font-medium text-earth-500 hover:text-earth-700 transition-colors"
              >
                Details <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-6">
              <ActivityFeed transactions={transactions} />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Chamas */}
          <div className="card">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-earth-100">
              <h2 className="font-display text-lg text-ink-900">My Chamas</h2>
              <Link
                href="/chama"
                className="text-xs font-medium text-earth-500 hover:text-earth-700 transition-colors"
              >
                Manage
              </Link>
            </div>
            <div className="p-6">
              <RecentChamas chamas={chamas} memberLevel={member.identity_level} />
            </div>
          </div>

          {/* Active vote */}
          {openVotes.length > 0 && (
            <Link href="/governance" className="block group">
              <div className="card flex items-center gap-4 p-5 transition-all group-hover:border-amber-300 group-hover:shadow-md group-hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Active Vote</p>
                  <p className="text-sm font-medium text-ink-900 truncate">{openVotes[0].proposal}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-earth-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            </Link>
          )}

          {/* USSD card */}
          <div className="rounded-xl bg-ink-900 text-white p-6 overflow-hidden relative">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-base">📱</div>
                <h4 className="font-display text-base">Offline Access</h4>
              </div>
              <p className="text-sm text-ink-300 leading-relaxed">
                No data? No problem. Use our secure USSD gateway to manage your trust score.
              </p>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 font-mono text-sm space-y-2">
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

function StatCard({
  icon, label, value, color, prefix, suffix,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  prefix?: string
  suffix?: string
}) {
  return (
    <div className="card p-5">
      <div className={`w-8 h-8 rounded-lg ${color} text-white flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-[11px] font-semibold text-earth-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        {prefix && <span className="text-xs font-medium text-earth-300">{prefix}</span>}
        <p className="font-display text-2xl text-ink-900">{value}</p>
        {suffix && <span className="text-xs font-medium text-earth-400 ml-0.5">{suffix}</span>}
      </div>
    </div>
  )
}

function QuickAction({
  href, icon, label, locked,
}: {
  href: string
  icon: React.ReactNode
  label: string
  locked: boolean
}) {
  const inner = (
    <>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
        locked
          ? 'bg-earth-50 text-earth-200'
          : 'bg-earth-100 text-earth-600 group-hover:bg-earth-600 group-hover:text-white'
      }`}>
        {icon}
      </div>
      <span className={`text-xs font-semibold uppercase tracking-tight ${locked ? 'text-earth-300' : 'text-ink-800'}`}>
        {label}
      </span>
      {locked && (
        <span className="absolute top-2 right-2 text-[10px] text-earth-300 font-mono">
          locked
        </span>
      )}
    </>
  )

  if (locked) {
    return (
      <div className="card p-5 opacity-50 flex flex-col items-center gap-3 relative">
        {inner}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="card p-5 flex flex-col items-center gap-3 group transition-all hover:border-earth-300 hover:shadow-md hover:-translate-y-0.5 relative"
    >
      {inner}
    </Link>
  )
}