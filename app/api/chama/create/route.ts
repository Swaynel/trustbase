import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decimalToNumber, dateToISOString } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  if (member.identity_level < 3) {
    return NextResponse.json({ error: 'Level 3 required to create a savings group' }, { status: 403 })
  }

  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const contributionAmount = Number(body.contributionAmount)
  const cycleDays = Number(body.cycleDays)

  if (!name) {
    return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
  }

  if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) {
    return NextResponse.json({ error: 'Contribution amount must be greater than zero' }, { status: 400 })
  }

  if (!Number.isFinite(cycleDays) || cycleDays <= 0) {
    return NextResponse.json({ error: 'Cycle days must be greater than zero' }, { status: 400 })
  }

  const chama = await prisma.$transaction(async (tx) => {
    const created = await tx.chama.create({
      data: {
        name,
        description: description || null,
        contribution_amount: contributionAmount,
        cycle_days: cycleDays,
        created_by: member.id,
        status: 'forming',
      },
    })

    await tx.chamaMember.create({
      data: {
        chama_id: created.id,
        member_id: member.id,
      },
    })

    return created
  })

  return NextResponse.json({
    chama: {
      ...chama,
      contribution_amount: decimalToNumber(chama.contribution_amount),
      balance: decimalToNumber(chama.balance),
      current_cycle_end: dateToISOString(chama.current_cycle_end),
      created_at: chama.created_at.toISOString(),
    },
  })
}
