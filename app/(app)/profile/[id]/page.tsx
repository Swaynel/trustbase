import Avatar from '@/components/ui/Avatar'
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { Calendar, Globe2, Hash, Shield, Star, Users } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'

type MemberProfilePageProps = {
  params: Promise<{ id: string }>
}

const LEVEL_NAMES = ['Observer', 'Participant', 'Member', 'Trusted Member', 'Community Anchor']
const LANG_NAMES: Record<string, string> = { en: 'English', sw: 'Swahili', fr: 'Français', ar: 'العربية' }
const LEVEL_DOT_CLASSES = ['bg-zinc-400', 'bg-amber-500', 'bg-orange-500', 'bg-forest-400', 'bg-[var(--color-bronze)]']

type LoanStatRow = {
  status: string
}

type ContributionStatRow = {
  status: string
}

export default async function MemberProfilePage({ params }: MemberProfilePageProps) {
  const { id } = await params
  const { user, member: currentMember } = await getCurrentUserWithMember()

  if (!user) redirect('/login')
  if (!currentMember) redirect('/login')
  if (id === currentMember.id) redirect('/profile')

  const [member, pillars, txCount, chamaCount, loanStatsRaw, contribsRaw] = await Promise.all([
    prisma.member.findUnique({
      where: { id },
    }),
    prisma.identityPillar.findFirst({
      where: { member_id: id },
    }),
    prisma.transaction.count({
      where: { member_id: id },
    }),
    prisma.chamaMember.count({
      where: { member_id: id },
    }),
    prisma.loan.findMany({
      where: { borrower_id: id },
      select: { status: true },
    }),
    prisma.contribution.findMany({
      where: { member_id: id },
      select: { status: true },
    }),
  ])

  if (!member) notFound()

  const loanStats: LoanStatRow[] = loanStatsRaw
  const contribs: ContributionStatRow[] = contribsRaw

  const repaidLoans = loanStats.filter((loan: LoanStatRow) => loan.status === 'repaid').length
  const totalLoans = loanStats.length
  const repayRate = totalLoans > 0 ? Math.round((repaidLoans / totalLoans) * 100) : 100

  const successfulContributions = contribs.filter((contribution: ContributionStatRow) => contribution.status === 'success').length
  const totalContributions = contribs.length
  const savingsConsistency = totalContributions > 0 ? Math.round((successfulContributions / totalContributions) * 100) : 0
  const joinedDate = new Date(member.created_at).toLocaleDateString()

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

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-1.5">
        <h1 className="mb-0 font-display text-3xl tracking-tight text-ink-100 sm:text-4xl">Member Profile</h1>
        <p className="mb-0 max-w-2xl text-sm leading-relaxed text-earth-400 sm:text-base">
          Community identity and contribution snapshot for this TrustBase member.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-earth-100 bg-earth-50/60 p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-4">
            <Avatar
              name={member.display_name || 'Member'}
              cloudinaryPublicId={member.cloudinary_profile_id || undefined}
              size="lg"
              rounded="full"
            />
            <div className="min-w-0 pt-0.5">
              <div className="mb-1 flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-2xl text-ink-100">{member.display_name || 'Anonymous'}</h2>
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${LEVEL_DOT_CLASSES[member.identity_level] || LEVEL_DOT_CLASSES[0]}`} />
              </div>
              <p className="mb-2 text-sm text-earth-500">
                {LEVEL_NAMES[member.identity_level] || LEVEL_NAMES[0]}
                <span className="mx-1.5 opacity-40">·</span>
                {LANG_NAMES[member.language] || member.language}
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-earth-500">
                {member.origin_country && (
                  <span className="surface-chip text-xs">
                    <Globe2 className="h-3.5 w-3.5" />
                    {member.origin_country}
                  </span>
                )}
                {member.origin_region && (
                  <span className="surface-chip text-xs">
                    {member.origin_region}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-earth-100 overflow-hidden rounded-lg border border-earth-100 bg-earth-800 sm:grid-cols-4 sm:divide-y-0">
            <MiniStat icon={<Shield className="w-3.5 h-3.5" />} label="Level" value={`${member.identity_level}/4`} />
            <MiniStat icon={<Star className="w-3.5 h-3.5" />} label="Reputation" value={`${Math.round(decimalToNumber(member.reputation_score))}`} suffix="/100" />
            <MiniStat icon={<Calendar className="w-3.5 h-3.5" />} label="Joined" value={joinedDate} />
            <MiniStat icon={<Hash className="w-3.5 h-3.5" />} label="Transactions" value={String(txCount)} />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-base text-ink-100">Identity pillars</h3>
              <p className="mt-0.5 text-sm text-earth-400">Signals that build trust and participation across the network</p>
            </div>
            <span className="surface-chip text-xs font-medium text-earth-300">
              Level {member.identity_level} Status
            </span>
          </div>

          <div className="grid overflow-hidden rounded-lg border border-earth-100 divide-earth-100 sm:grid-cols-3 sm:divide-x">
            <PillarRow
              name="Origin Web"
              desc="Community corroboration of origin"
              done={serializedPillars?.pillar_1_done}
              detail={serializedPillars?.pillar_1_done ? 'Complete' : `${Math.round(serializedPillars?.pillar_1_score || 0)}% progress`}
            />
            <PillarRow
              name="Presence Pulse"
              desc="Consistent phone and financial activity"
              done={serializedPillars?.pillar_2_done}
              detail={serializedPillars?.pillar_2_done ? 'Complete' : `${serializedPillars?.p2_days_present || 0}/30 days`}
            />
            <PillarRow
              name="Activity Threads"
              desc="Transactions with different members"
              done={serializedPillars?.pillar_3_done}
              detail={serializedPillars?.pillar_3_done ? 'Complete' : `${serializedPillars?.p3_threads || 0}/5 partners`}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="px-6 pt-6 pb-5">
            <h3 className="mb-4 font-display text-base text-ink-100">Community standing</h3>
            <div className="grid grid-cols-2 divide-x divide-y divide-earth-100 overflow-hidden rounded-lg border border-earth-100">
              <StatBlock label="Savings groups" value={String(chamaCount)} />
              <StatBlock label="Loans taken" value={String(totalLoans)} />
              <StatBlock label="Repayment rate" value={`${repayRate}%`} />
              <StatBlock label="Savings consistency" value={totalContributions > 0 ? `${savingsConsistency}%` : 'N/A'} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="px-6 pt-6 pb-5">
            <h3 className="mb-4 font-display text-base text-ink-100">Trust signals</h3>
            <div className="space-y-3">
              <SignalRow
                icon={<Users className="h-4 w-4" />}
                label="Savings participation"
                value={chamaCount > 0 ? `${chamaCount} active group${chamaCount === 1 ? '' : 's'}` : 'No savings groups yet'}
              />
              <SignalRow
                icon={<Shield className="h-4 w-4" />}
                label="Identity tier"
                value={LEVEL_NAMES[member.identity_level] || LEVEL_NAMES[0]}
              />
              <SignalRow
                icon={<Star className="h-4 w-4" />}
                label="Reputation score"
                value={`${Math.round(decimalToNumber(member.reputation_score))}/100`}
              />
              <SignalRow
                icon={<Calendar className="h-4 w-4" />}
                label="Time on platform"
                value={`Joined ${joinedDate}`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode
  label: string
  value: string
  suffix?: string
}) {
  return (
    <div className="flex flex-col justify-center px-4 py-3.5">
      <div className="mb-1 flex items-center gap-1.5 text-earth-400">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-base font-semibold text-ink-100">
        {value}
        {suffix && <span className="ml-0.5 text-xs font-medium text-earth-400">{suffix}</span>}
      </p>
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col bg-earth-800 px-5 py-4">
      <p className="mb-0.5 font-display text-2xl text-ink-100">{value}</p>
      <p className="text-xs text-earth-400">{label}</p>
    </div>
  )
}

function PillarRow({
  name,
  desc,
  done,
  detail,
}: {
  name: string
  desc: string
  done?: boolean
  detail: string
}) {
  return (
    <div className="border-t border-earth-100 px-5 py-4 first:border-t-0 sm:border-t-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-medium text-ink-100">{name}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${done ? 'bg-green-100 text-green-700' : 'bg-earth-100 text-earth-300'}`}>
          {done ? 'Done' : 'In progress'}
        </span>
      </div>
      <p className="text-sm text-earth-500">{desc}</p>
      <p className="mt-2 text-xs text-earth-600">{detail}</p>
    </div>
  )
}

function SignalRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-earth-100 bg-earth-50/50 px-4 py-3">
      <div className="mt-0.5 text-earth-500">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wider text-earth-400">{label}</p>
        <p className="text-sm font-medium text-ink-100">{value}</p>
      </div>
    </div>
  )
}
