// app/api/governance/vote/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

type VoteResponseRow = {
  choice: string
  weight: Parameters<typeof decimalToNumber>[0]
}

function getVoteWeight(level: number): number {
  if (level === 0) return 0 // observers cannot vote
  if (level === 4) return 3 // anchors have 3x weight
  return level // levels 1-3 vote with weight = level
}

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { voteId, choice } = await req.json()

  if (!['yes', 'no'].includes(choice)) {
    return NextResponse.json({ error: 'choice must be yes or no' }, { status: 400 })
  }

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const weight = getVoteWeight(member.identity_level)
  if (weight === 0) {
    return NextResponse.json({ error: 'Level 1+ required to vote' }, { status: 403 })
  }

  // Check vote is open
  const vote = await prisma.vote.findUnique({
    where: { id: voteId },
    select: { id: true, status: true, window_closes_at: true },
  })

  if (!vote || vote.status !== 'open') {
    return NextResponse.json({ error: 'Vote is not open' }, { status: 400 })
  }

  if (new Date(vote.window_closes_at) < new Date()) {
    return NextResponse.json({ error: 'Voting window has closed' }, { status: 400 })
  }

  // Upsert vote response (one vote per member per proposal)
  await prisma.voteResponse.upsert({
    where: {
      vote_id_member_id: {
        vote_id: voteId,
        member_id: member.id,
      },
    },
    update: {
      choice,
      weight,
    },
    create: {
      vote_id: voteId,
      member_id: member.id,
      choice,
      weight,
    },
  })

  // Update running totals on votes table
  const allResponses: VoteResponseRow[] = await prisma.voteResponse.findMany({
    where: { vote_id: voteId },
    select: { choice: true, weight: true },
  })

  const yes = allResponses
    .filter((response: VoteResponseRow) => response.choice === 'yes')
    .reduce((sum, response) => sum + decimalToNumber(response.weight), 0)
  const no = allResponses
    .filter((response: VoteResponseRow) => response.choice === 'no')
    .reduce((sum, response) => sum + decimalToNumber(response.weight), 0)

  await prisma.vote.update({
    where: { id: voteId },
    data: { yes_weight: yes, no_weight: no },
  })

  return NextResponse.json({ message: `Vote recorded: ${choice.toUpperCase()}`, weight, yes, no })
}
