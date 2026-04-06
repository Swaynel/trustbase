// app/api/governance/proposals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient, getCurrentUserWithMember } from '@/lib/supabase/server'

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
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'open'

  const { data } = await supabase
    .from('votes')
    .select('*, proposer:members!proposer_id(display_name, identity_level)')
    .eq('status', status)
    .order('created_at', { ascending: false })

  return NextResponse.json({ proposals: data || [] })
}
