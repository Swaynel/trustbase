// app/(app)/governance/page.tsx
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Vote, CheckCircle2, XCircle, Clock } from 'lucide-react'
import VoteButton from '@/components/governance/VoteButton'
import CreateProposalModal from '@/components/governance/CreateProposalModal'

type DecimalValue = Parameters<typeof decimalToNumber>[0]

type VoteRow = {
  id: string
  proposal: string
  yes_weight: DecimalValue
  no_weight: DecimalValue
  result: string | null
  window_closes_at: Date
}

type GovernanceRuleRow = {
  key: string
  value: string
}

type VoteResponseRow = {
  vote_id: string
}

export default async function GovernancePage() {
  const { user, member } = await getCurrentUserWithMember()
  if (!user || !member) redirect('/login')

  const [openVoteRowsRaw, closedVoteRowsRaw, rulesRaw] = await Promise.all([
    prisma.vote.findMany({
      where: { status: 'open', window_closes_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    }),
    prisma.vote.findMany({
      where: { status: 'closed' },
      orderBy: { window_closes_at: 'desc' },
      take: 10,
    }),
    prisma.governanceRule.findMany({ orderBy: { key: 'asc' } }),
  ])

  const openVoteRows: VoteRow[] = openVoteRowsRaw
  const closedVoteRows: VoteRow[] = closedVoteRowsRaw
  const rules: GovernanceRuleRow[] = rulesRaw

  const serialize = (vote: VoteRow) => ({
    ...vote,
    yes_weight: decimalToNumber(vote.yes_weight),
    no_weight: decimalToNumber(vote.no_weight),
  })

  const openVotes  = openVoteRows.map(serialize)
  const closedVotes = closedVoteRows.map(serialize)

  const myVoteIds = new Set<string>()
  if (openVotes.length) {
    const myResponses: VoteResponseRow[] = await prisma.voteResponse.findMany({
      where: { member_id: member.id, vote_id: { in: openVotes.map((v) => v.id) } },
      select: { vote_id: true },
    })
    myResponses.forEach((r: VoteResponseRow) => myVoteIds.add(r.vote_id))
  }

  const WEIGHT = member.identity_level === 4 ? 3 : member.identity_level
  const LEVEL_NAMES = ['Observer', 'Participant', 'Member', 'Trusted Member', 'Community Anchor']
  const now = new Date()

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="section-title">Governance</h1>
          <p className="section-sub">Vote on community rules and fund allocations</p>
        </div>
        {member.identity_level >= 3 && <CreateProposalModal />}
      </div>

      {/* Voting weight card */}
      <div className="card p-6">
        <div className="flex items-stretch gap-8">

          {/* Weight display */}
          <div className="flex flex-col justify-center gap-1 min-w-[120px]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-earth-400">
              Governance weight
            </p>
            <div className="flex items-start gap-1">
              <p className="font-display text-5xl leading-none text-ink-100">{WEIGHT}</p>
              <span className="text-xl mt-1 text-earth-400">×</span>
            </div>
            <p className="text-sm font-medium text-earth-300">
              {LEVEL_NAMES[member.identity_level]}
            </p>
          </div>

          {/* Weight scale */}
          <div className="flex-1 border-l border-earth-100 pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-earth-400 mb-3">
              Weight by level
            </p>
            <div className="space-y-1.5">
              {LEVEL_NAMES.map((name, i) => {
                const w = i === 4 ? 3 : i
                const active = i === member.identity_level
                return (
                  <div
                    key={name}
                    className={`flex items-center justify-between text-sm ${
                      active ? 'font-semibold text-ink-100' : 'text-earth-400'
                    }`}
                  >
                    <span>{name}</span>
                    <span className={active ? 'text-earth-600' : ''}>{w}×</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* How voting works */}
      <div className="card p-5 bg-earth-50/60 border-earth-200">
        <p className="text-xs font-semibold text-earth-300 mb-2">How community voting works</p>
        <ul className="text-xs text-earth-400 space-y-1 list-disc list-inside">
          <li>Level 3+ members can submit proposals for the community to vote on</li>
          <li>Voting weight scales with identity level — anchors carry 3× the weight of participants</li>
          <li>Proposals resolve at the end of the voting window via weighted majority</li>
          <li>Passed proposals automatically update platform rules or trigger allocations</li>
          <li>SMS voting: reply YES or NO to any vote notification SMS</li>
        </ul>
      </div>

      {/* Open votes */}
      <section>
        <h2 className="font-display text-lg text-ink-100 mb-3">
          Open votes ({openVotes.length})
        </h2>

        {!openVotes.length ? (
          <div className="card flex flex-col items-center justify-center py-12 gap-2">
            <Vote className="w-8 h-8 text-earth-200" />
            <p className="text-sm text-earth-400">No open votes right now</p>
          </div>
        ) : (
          <div className="space-y-4">
            {openVotes.map((v) => {
              const total   = v.yes_weight + v.no_weight
              const yesPct  = total > 0 ? Math.round((v.yes_weight / total) * 100) : 50
              const noPct   = 100 - yesPct
              const closesIn = Math.ceil((new Date(v.window_closes_at).getTime() - now.getTime()) / 86_400_000)
              const hasVoted = myVoteIds.has(v.id)

              return (
                <div key={v.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <p className="font-medium text-ink-100 flex-1 leading-snug">{v.proposal}</p>
                    <span className="badge bg-amber-100 text-amber-700 flex-shrink-0 flex items-center gap-1 text-xs">
                      <Clock className="w-3 h-3" />
                      {closesIn}d left
                    </span>
                  </div>

                  {/* Tally bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-earth-500 mb-1.5">
                      <span>Yes {yesPct}%</span>
                      <span>No {noPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-earth-100 overflow-hidden">
                      <div
                        className="h-full bg-forest-400 rounded-full transition-all duration-700"
                        style={{ width: `${yesPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-earth-400 mt-1.5 text-right">
                      {total} weighted vote{total !== 1 ? 's' : ''} cast
                    </p>
                  </div>

                  {member.identity_level > 0 && !hasVoted && (
                    <VoteButton voteId={v.id} weight={WEIGHT} />
                  )}
                  {hasVoted && (
                    <p className="flex items-center gap-1.5 text-xs text-earth-500">
                      <CheckCircle2 className="w-3.5 h-3.5 text-forest-500" />
                      You voted
                    </p>
                  )}
                  {member.identity_level === 0 && (
                    <p className="text-xs text-earth-400">Reach Level 1 to vote.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Past votes */}
      {closedVotes.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-ink-100 mb-3">Past votes</h2>
          <div className="card divide-y divide-earth-100">
            {closedVotes.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                {v.result === 'passed'
                  ? <CheckCircle2 className="w-4 h-4 text-forest-500 flex-shrink-0" />
                  : <XCircle     className="w-4 h-4 text-red-400 flex-shrink-0" />
                }
                <p className="flex-1 text-sm text-ink-100 truncate">{v.proposal}</p>
                <span className={`badge text-xs flex-shrink-0 ${
                  v.result === 'passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {v.result ?? 'resolved'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Community rules */}
      {rules.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-ink-100 mb-3">Community rules</h2>
          <div className="card divide-y divide-earth-100">
            {rules.map((r) => (
              <div key={r.key} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm text-earth-500 font-mono">{r.key.replace(/_/g, ' ')}</p>
                <p className="text-sm font-medium text-ink-100">{r.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
