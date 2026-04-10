// app/(app)/profile/page.tsx
import { prisma } from '@/lib/prisma'
import { decimalToNumber, dateToISOString } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Star, Shield, Calendar, Hash } from 'lucide-react'
import CreditNarrativeSection from '@/components/identity/CreditNarrativeSection'
import OriginCorroborate from '@/components/identity/OriginCorroborate'
import LanguageSetting from '@/components/profile/LanguageSetting'
import ProfileAvatarUploader from '@/components/profile/ProfileAvatarUploader'
import { getProfileUrl } from '@/lib/cloudinary'

const LEVEL_NAMES = ['Observer', 'Participant', 'Member', 'Trusted Member', 'Community Anchor']
const LANG_NAMES: Record<string, string> = { en: 'English', sw: 'Swahili', fr: 'Français', ar: 'العربية' }
const LEVEL_DOT_CLASSES = ['bg-zinc-400', 'bg-amber-500', 'bg-orange-500', 'bg-forest-400', 'bg-[var(--color-bronze)]']

type LoanStatRow = {
  status: string
}

type ContributionStatRow = {
  status: string
}

export default async function ProfilePage() {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')
  if (!member) redirect('/login')

  const [pillars, txCount, chamaCount, loanStatsRaw, contribsRaw] = await Promise.all([
    prisma.identityPillar.findFirst({
      where: { member_id: member.id },
    }),
    prisma.transaction.count({
      where: { member_id: member.id },
    }),
    prisma.chamaMember.count({
      where: { member_id: member.id },
    }),
    prisma.loan.findMany({
      where: { borrower_id: member.id },
      select: { status: true },
    }),
    prisma.contribution.findMany({
      where: { member_id: member.id },
      select: { status: true },
    }),
  ])

  const loanStats: LoanStatRow[] = loanStatsRaw
  const contribs: ContributionStatRow[] = contribsRaw

  const repaidLoans = loanStats.filter((loan: LoanStatRow) => loan.status === 'repaid').length
  const totalLoans = loanStats.length
  const repayRate = totalLoans > 0 ? Math.round((repaidLoans / totalLoans) * 100) : 100
  const now = new Date()
  const daysSince = Math.floor((now.getTime() - new Date(member.created_at).getTime()) / 86400000)

  const successContribs = contribs.filter((c: ContributionStatRow) => c.status === 'success').length
  const totalContribs = contribs.length
  const savingsConsistency = totalContribs > 0 ? Math.round((successContribs / totalContribs) * 100) : 0

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

  const narrativeProps = {
    memberId: member.id,
    displayName: member.display_name || 'Member',
    level: member.identity_level,
    tenureDays: daysSince,
    savingsConsistencyPct: savingsConsistency,
    loanRepaymentRate: repayRate,
    transactionCount: txCount || 0,
    language: member.language,
    existingNarrative: member.credit_narrative,
    generatedAt: dateToISOString(member.credit_narrative_at),
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">

      {/* Page Header */}
      <div className="space-y-1.5">
        <h1 className="mb-0 font-display text-3xl tracking-tight text-ink-100 sm:text-4xl">My Profile</h1>
        <p className="mb-0 max-w-2xl text-sm leading-relaxed text-earth-400 sm:text-base">
          Your TrustBase identity and financial passport
        </p>
      </div>

      {/* Hero Identity Card */}
      <div className="card overflow-hidden">

        {/* Top: Profile header + mini stats */}
        <div className="border-b border-earth-100 bg-earth-50/60 p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-6">
            <ProfileAvatarUploader
              displayName={member.display_name || 'Member'}
              cloudinaryProfileId={member.cloudinary_profile_id}
              imageUrl={member.cloudinary_profile_id ? getProfileUrl(member.cloudinary_profile_id) : undefined}
            />
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h2 className="font-display text-2xl text-ink-100">{member.display_name || 'Anonymous'}</h2>
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${LEVEL_DOT_CLASSES[member.identity_level] || LEVEL_DOT_CLASSES[0]}`} />
              </div>
              <p className="text-sm text-earth-500 mb-2">
                {LEVEL_NAMES[member.identity_level]}
                <span className="mx-1.5 opacity-40">·</span>
                {LANG_NAMES[member.language] || member.language}
              </p>
              <p className="text-sm text-earth-300 leading-relaxed max-w-lg hidden sm:block">
                A living snapshot of your verified identity, community standing, and financial activity across TrustBase.
              </p>
            </div>
          </div>

          {/* Mini Stats — gap-divider grid, no individual card borders */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-earth-100 rounded-lg border border-earth-100 bg-earth-800 overflow-hidden">
            <MiniStat icon={<Shield className="w-3.5 h-3.5" />} label="Level" value={`${member.identity_level}/4`} />
            <MiniStat icon={<Star className="w-3.5 h-3.5" />} label="Reputation" value={`${Math.round(member.reputation_score)}`} suffix="/100" />
            <MiniStat icon={<Calendar className="w-3.5 h-3.5" />} label="Active Days" value={String(daysSince)} />
            <MiniStat icon={<Hash className="w-3.5 h-3.5" />} label="Transactions" value={String(txCount || 0)} />
          </div>
        </div>

        {/* Bottom: Identity pillars */}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="font-display text-base text-ink-100">Identity pillars</h3>
              <p className="text-sm text-earth-400 mt-0.5">Signals used to strengthen trust across the network</p>
            </div>
            <span className="surface-chip text-xs font-medium text-earth-300">
              Level {member.identity_level} Status
            </span>
          </div>

          {/* Pillars — gap-divider grid */}
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-earth-100 rounded-lg border border-earth-100 overflow-hidden">
            <PillarRow
              name="Origin Web"
              desc="Community corroboration of origin"
              done={serializedPillars?.pillar_1_done}
              detail={serializedPillars?.pillar_1_done ? 'Complete' : `${Math.round(serializedPillars?.pillar_1_score || 0)}% — need 3 more`}
            />
            <PillarRow
              name="Presence Pulse"
              desc="Consistent phone & financial activity"
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

      {/* Two-Column Content Area */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">

        {/* Left Column */}
        <div className="space-y-6">
          {!serializedPillars?.pillar_1_done && member.origin_country && (
            <OriginCorroborate
              memberId={member.id}
              originCountry={member.origin_country}
              currentScore={serializedPillars?.pillar_1_score || 0}
            />
          )}
          <CreditNarrativeSection {...narrativeProps} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">

          {/* Financial Record */}
          <div className="card">
            <div className="px-6 pt-6 pb-5">
              <h3 className="font-display text-base text-ink-100 mb-4">Financial record</h3>
              {/* StatBlocks — gap-divider grid */}
              <div className="grid grid-cols-2 divide-x divide-y divide-earth-100 rounded-lg border border-earth-100 overflow-hidden">
                <StatBlock label="Savings groups" value={String(chamaCount || 0)} />
                <StatBlock label="Total Loans" value={String(totalLoans)} />
                <StatBlock label="Repayment rate" value={`${repayRate}%`} />
                <StatBlock label="Savings consistency" value={totalContribs > 0 ? `${savingsConsistency}%` : 'N/A'} />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="card">
            <div className="px-6 pt-6 pb-5">
              <h3 className="font-display text-base text-ink-100 mb-4">Preferences</h3>
              <LanguageSetting currentLanguage={member.language} />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// --- Sub-Components ---

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
        {suffix && <span className="text-xs font-medium text-earth-400 ml-0.5">{suffix}</span>}
      </p>
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col px-5 py-4 bg-earth-800">
      <p className="font-display text-2xl text-ink-100 mb-0.5">{value}</p>
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
    <div className={`flex flex-col gap-3 p-5 ${done ? 'bg-forest-400/10' : 'bg-earth-800'}`}>
      <div className="flex items-center justify-between">
        <div
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold
            ${done ? 'bg-forest-500 text-white' : 'bg-earth-100 text-earth-500'}`}
        >
          {done ? '✓' : '·'}
        </div>
        <span className={`text-xs font-medium ${done ? 'text-forest-600' : 'text-earth-400'}`}>
          {detail}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-100 mb-0.5">{name}</p>
        <p className="text-xs leading-relaxed text-earth-400">{desc}</p>
      </div>
    </div>
  )
}
