// app/api/chama/contribute/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { chamaId } = await req.json()

  if (!member || member.identity_level < 1) {
    return NextResponse.json({ error: 'Level 1 required to contribute' }, { status: 403 })
  }

  const membership = await prisma.chamaMember.findUnique({
    where: {
      chama_id_member_id: {
        chama_id: chamaId,
        member_id: member.id,
      },
    },
  })

  if (!membership) return NextResponse.json({ error: 'Not a member of this chama' }, { status: 403 })

  const chama = await prisma.chama.findUnique({
    where: { id: chamaId },
    select: { contribution_amount: true, status: true },
  })

  if (!chama) return NextResponse.json({ error: 'Chama not found' }, { status: 404 })
  if (chama.status !== 'active') {
    return NextResponse.json({ error: 'Chama is not active' }, { status: 400 })
  }

  // Return amount for the client to initiate Paystack charge
  return NextResponse.json({ amount: chama.contribution_amount.toNumber(), chamaId })
}

export async function GET(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const chamaId = searchParams.get('chamaId')

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const contributions = await prisma.contribution.findMany({
    where: {
      member_id: member.id,
      ...(chamaId ? { chama_id: chamaId } : {}),
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({
    contributions: contributions.map((contribution) => ({
      ...contribution,
      amount: contribution.amount.toNumber(),
      created_at: contribution.created_at.toISOString(),
    })),
  })
}
