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
  if (!user) redirect('/login')

  if (!member) redirect('/login')

  const [openVoteRowsRaw, closedVoteRowsRaw, rulesRaw] = await Promise.all([
    prisma.vote.findMany({
      where: {
        status: 'open',
        window_closes_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.vote.findMany({
      where: { status: 'closed' },
      orderBy: { window_closes_at: 'desc' },
      take: 10,
    }),
    prisma.governanceRule.findMany({
      orderBy: { key: 'asc' },
    }),
  ])

  const openVoteRows: VoteRow[] = openVoteRowsRaw
  const closedVoteRows: VoteRow[] = closedVoteRowsRaw
  const rules: GovernanceRuleRow[] = rulesRaw

  const openVotes = openVoteRows.map((vote: VoteRow) => ({
    ...vote,
    yes_weight: decimalToNumber(vote.yes_weight),
    no_weight: decimalToNumber(vote.no_weight),
  }))

  const closedVotes = closedVoteRows.map((vote: VoteRow) => ({
    ...vote,
    yes_weight: decimalToNumber(vote.yes_weight),
    no_weight: decimalToNumber(vote.no_weight),
  }))

  const myVoteIds = new Set<string>()
  if (openVotes.length) {
    const myResponses: VoteResponseRow[] = await prisma.voteResponse.findMany({
      where: {
        member_id: member.id,
        vote_id: { in: openVotes.map((vote) => vote.id) },
      },
        select: { vote_id: true },
      })

    myResponses.forEach((response: VoteResponseRow) => myVoteIds.add(response.vote_id))
  }

  const WEIGHT = member.identity_level === 4 ? 3 : member.identity_level
  const LEVEL_NAMES = ['Observer', 'Participant', 'Member', 'Trusted Member', 'Community Anchor']
  const now = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-title">Governance</h1>
          <p className="section-sub">Vote on community rules and fund allocations</p>
        </div>
        {member.identity_level >= 3 && (
          <CreateProposalModal />
        )}
      </div>

      {/* My voting power */}
      <div className="card bg-earth-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-earth-200 mb-1">Your governance weight</p>
            <p className="font-display text-4xl">{WEIGHT}×</p>
            <p className="text-xs text-earth-200 mt-1">{LEVEL_NAMES[member.identity_level]}</p>
          </div>
          <div className="text-right text-xs text-earth-200 space-y-1">
            <p>Observer: 0×</p>
            <p>Participant: 1×</p>
            <p>Member: 2×</p>
            <p>Trusted: 3×</p>
            <p className="font-medium text-white">Anchor: 3×</p>
          </div>
        </div>
      </div>

      {/* How voting works */}
      <div className="card bg-earth-50 border-earth-200">
        <p className="text-xs font-medium text-earth-700 mb-2">How community voting works</p>
        <div className="text-xs text-earth-600 space-y-1">
          <p>• Level 3+ members can submit proposals for the community to vote on</p>
          <p>• Voting weight scales with identity level — anchors carry 3× the weight of participants</p>
          <p>• Proposals resolve at the end of the voting window via weighted majority</p>
          <p>• Passed proposals automatically update platform rules or trigger allocations</p>
          <p>• SMS voting: reply YES or NO to any vote notification SMS</p>
        </div>
      </div>

      {/* Open votes */}
      <section>
        <h2 className="font-display text-lg text-ink-900 mb-3">
          Open votes ({openVotes.length || 0})
        </h2>

        {!openVotes.length ? (
          <div className="card text-center py-10">
            <Vote className="w-10 h-10 text-earth-300 mx-auto mb-2" />
            <p className="text-sm text-earth-400">No open votes right now</p>
          </div>
        ) : (
          <div className="space-y-4">
            {openVotes.map((v) => {
              const total = v.yes_weight + v.no_weight
              const yesPct = total > 0 ? Math.round((v.yes_weight / total) * 100) : 50
              const noPct = 100 - yesPct
              const closesIn = Math.ceil((new Date(v.window_closes_at).getTime() - now.getTime()) / 86400000)
              const hasVoted = myVoteIds.has(v.id)

              return (
                <div key={v.id} className="card border-earth-200">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <p className="font-medium text-ink-900 flex-1">{v.proposal}</p>
                    <span className="badge bg-amber-100 text-amber-700 flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {closesIn}d left
                    </span>
                  </div>

                  {/* Tally bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-earth-500 mb-1">
                      <span>YES {yesPct}%</span>
                      <span>NO {noPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-red-100 overflow-hidden">
                      <div className="h-full bg-forest-400 rounded-full transition-all"
                        style={{ width: `${yesPct}%` }} />
                    </div>
                    <p className="text-xs text-earth-400 mt-1 text-right">
                      {total} weighted vote{total !== 1 ? 's' : ''} cast
                    </p>
                  </div>

                  {member.identity_level > 0 && !hasVoted && (
                    <VoteButton voteId={v.id} weight={WEIGHT} />
                  )}
                  {hasVoted && (
                    <p className="text-xs text-earth-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-forest-500" /> You voted
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

      {/* Closed votes */}
      {closedVotes.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-ink-900 mb-3">Past votes</h2>
          <div className="space-y-2">
            {closedVotes.map((v) => (
              <div key={v.id} className="card py-3 px-4 flex items-center gap-3">
                {v.result === 'passed'
                  ? <CheckCircle2 className="w-4 h-4 text-forest-500 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                }
                <p className="flex-1 text-sm text-ink-800 truncate">{v.proposal}</p>
                <span className={`badge text-xs flex-shrink-0
                  ${v.result === 'passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {v.result || 'resolved'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Current rules */}
      {rules.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-ink-900 mb-3">Community rules</h2>
          <div className="card">
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.key} className="flex items-center justify-between py-2 border-b border-earth-100 last:border-0">
                  <p className="text-sm text-earth-600 font-mono">{r.key.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-medium text-ink-900">{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
