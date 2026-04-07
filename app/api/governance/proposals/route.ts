// app/api/governance/proposals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

type DecimalValue = Parameters<typeof decimalToNumber>[0]

type VoteRow = {
  id: string
  proposer_id: string
  proposal: string
  yes_weight: DecimalValue
  no_weight: DecimalValue
  created_at: Date
  window_closes_at: Date
}

type ProposerRow = {
  id: string
  display_name: string | null
  identity_level: number
}

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { proposal, windowDays = 3 } = await req.json()

  if (!member || member.identity_level < 3) {
    return NextResponse.json({ error: 'Level 3 required to create proposals' }, { status: 403 })
  }

  const windowClosesAt = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000)

  const vote = await prisma.vote.create({
    data: {
      proposal,
      proposer_id: member.id,
      status: 'open',
      window_closes_at: windowClosesAt,
    },
  })

  return NextResponse.json({
    vote: {
      ...vote,
      yes_weight: vote.yes_weight.toNumber(),
      no_weight: vote.no_weight.toNumber(),
      window_closes_at: vote.window_closes_at.toISOString(),
      created_at: vote.created_at.toISOString(),
    },
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'open'
  const votes: VoteRow[] = await prisma.vote.findMany({
    where: { status },
    orderBy: { created_at: 'desc' },
  })

  const proposerIds = Array.from(new Set(votes.map((vote: VoteRow) => vote.proposer_id)))
  const proposers: ProposerRow[] = proposerIds.length
    ? await prisma.member.findMany({
        where: { id: { in: proposerIds } },
        select: { id: true, display_name: true, identity_level: true },
      })
    : []
  const proposerMap = new Map<string, ProposerRow>(
    proposers.map((proposer: ProposerRow) => [proposer.id, proposer])
  )

  return NextResponse.json({
    proposals: votes.map((vote: VoteRow) => ({
      ...vote,
      yes_weight: decimalToNumber(vote.yes_weight),
      no_weight: decimalToNumber(vote.no_weight),
      created_at: vote.created_at.toISOString(),
      window_closes_at: vote.window_closes_at.toISOString(),
      proposer: proposerMap.get(vote.proposer_id) || null,
    })),
  })
}
