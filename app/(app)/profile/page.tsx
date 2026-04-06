// app/(app)/profile/page.tsx
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserCircle, Download, Star, Shield, Calendar, Hash } from 'lucide-react'
import CreditNarrativeSection from '@/components/identity/CreditNarrativeSection'
import OriginCorroborate from '@/components/identity/OriginCorroborate'

const LEVEL_NAMES = ['Observer', 'Participant', 'Member', 'Trusted Member', 'Community Anchor']
const LANG_NAMES: Record<string, string> = { en: 'English', sw: 'Swahili', fr: 'Français', ar: 'العربية' }

export default async function ProfilePage() {
  const { supabase, user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!member) redirect('/login')

  const { data: pillars } = await supabase
    .from('identity_pillars')
    .select('*')
    .eq('member_id', member.id)
    .single()

  // Stats
  const { count: txCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', member.id)

  const { data: chamaCount } = await supabase
    .from('chama_members')
    .select('chama_id')
    .eq('member_id', member.id)

  const { data: loanStats } = await supabase
    .from('loans')
    .select('status')
    .eq('borrower_id', member.id)

  const repaidLoans = loanStats?.filter((l: any) => l.status === 'repaid').length || 0
  const totalLoans = loanStats?.length || 0
  const repayRate = totalLoans > 0 ? Math.round((repaidLoans / totalLoans) * 100) : 100
  const daysSince = Math.floor((Date.now() - new Date(member.created_at).getTime()) / 86400000)

  // Savings consistency (based on contributions)
  const { data: contribs } = await supabase
    .from('contributions')
    .select('status')
    .eq('member_id', member.id)

  const successContribs = contribs?.filter((c: any) => c.status === 'success').length || 0
  const totalContribs = contribs?.length || 0
  const savingsConsistency = totalContribs > 0 ? Math.round((successContribs / totalContribs) * 100) : 0

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
    generatedAt: member.credit_narrative_at,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">My Profile</h1>
        <p className="section-sub">Your TrustBase identity and financial passport</p>
      </div>

      {/* Profile card */}
      <div className="card">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-earth-500 flex items-center justify-center text-white text-2xl font-display">
            {(member.display_name || '?').charAt(0).toUpperCase()}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display text-2xl text-ink-900">{member.display_name || 'Anonymous'}</h2>
              <span className={`w-3 h-3 rounded-full level-${member.identity_level} flex-shrink-0`} />
            </div>
            <p className="text-sm text-earth-500 mb-3">{LEVEL_NAMES[member.identity_level]} · {LANG_NAMES[member.language] || member.language}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat icon={<Shield className="w-3.5 h-3.5" />} label="Level" value={`${member.identity_level}/4`} />
              <MiniStat icon={<Star className="w-3.5 h-3.5" />} label="Reputation" value={`${Math.round(member.reputation_score)}/100`} />
              <MiniStat icon={<Calendar className="w-3.5 h-3.5" />} label="Days active" value={String(daysSince)} />
              <MiniStat icon={<Hash className="w-3.5 h-3.5" />} label="Transactions" value={String(txCount || 0)} />
            </div>
          </div>
        </div>
      </div>

      {/* Identity pillars summary */}
      <div className="card">
        <h2 className="font-display text-lg text-ink-900 mb-4">Identity pillars</h2>
        <div className="space-y-3">
          <PillarRow
            name="Origin Web"
            desc="Community corroboration of your declared origin"
            done={pillars?.pillar_1_done}
            detail={pillars?.pillar_1_done ? 'Complete' : `${Math.round(pillars?.pillar_1_score || 0)}% — need 3 corroborations`}
          />
          <PillarRow
            name="Presence Pulse"
            desc="30 days of consistent phone and financial activity"
            done={pillars?.pillar_2_done}
            detail={pillars?.pillar_2_done ? 'Complete' : `${pillars?.p2_days_present || 0}/30 days`}
          />
          <PillarRow
            name="Activity Threads"
            desc="5 distinct financial transactions with different members"
            done={pillars?.pillar_3_done}
            detail={pillars?.pillar_3_done ? 'Complete' : `${pillars?.p3_threads || 0}/5 partners`}
          />
        </div>
      </div>

      {/* Origin corroboration (if Pillar 1 incomplete) */}
      {!pillars?.pillar_1_done && member.origin_country && (
        <OriginCorroborate
          memberId={member.id}
          originCountry={member.origin_country}
          currentScore={pillars?.pillar_1_score || 0}
        />
      )}

      {/* Financial stats */}
      <div className="card">
        <h2 className="font-display text-lg text-ink-900 mb-4">Financial record</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock label="Savings groups" value={String(chamaCount?.length || 0)} />
          <StatBlock label="Loans" value={String(totalLoans)} />
          <StatBlock label="Repayment rate" value={`${repayRate}%`} />
          <StatBlock label="Savings consistency" value={totalContribs > 0 ? `${savingsConsistency}%` : 'N/A'} />
        </div>
      </div>

      {/* Credit narrative */}
      <CreditNarrativeSection {...narrativeProps} />

      {/* Settings */}
      <div className="card">
        <h2 className="font-display text-lg text-ink-900 mb-4">Settings</h2>
        <LanguageSetting currentLanguage={member.language} memberId={member.id} authId={user.id} />
      </div>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-earth-50 rounded-xl px-3 py-2">
      <div className="flex items-center gap-1.5 text-earth-400 mb-0.5">{icon}<span className="text-xs">{label}</span></div>
      <p className="text-sm font-medium text-ink-900">{value}</p>
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-xl bg-earth-50">
      <p className="font-display text-xl text-ink-900">{value}</p>
      <p className="text-xs text-earth-400 mt-0.5">{label}</p>
    </div>
  )
}

function PillarRow({ name, desc, done, detail }: {
  name: string; desc: string; done?: boolean; detail: string
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl ${done ? 'bg-forest-400/5 border border-forest-400/20' : 'bg-earth-50'}`}>
      <div className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
        ${done ? 'bg-forest-400 text-white' : 'bg-earth-200 text-earth-500'}`}>
        {done ? '✓' : '·'}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-ink-900">{name}</p>
        <p className="text-xs text-earth-400">{desc}</p>
        <p className={`text-xs mt-0.5 ${done ? 'text-forest-600' : 'text-earth-500'}`}>{detail}</p>
      </div>
    </div>
  )
}

// Language setting (client component inlined for simplicity)
import LanguageSetting from '@/components/profile/LanguageSetting'
