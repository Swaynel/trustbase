import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const body = await req.json()
  const subjectId = typeof body.subjectId === 'string' ? body.subjectId.trim() : ''
  const originCountry = typeof body.originCountry === 'string' ? body.originCountry.trim() : ''

  if (!subjectId || !originCountry) {
    return NextResponse.json({ error: 'subjectId and originCountry are required' }, { status: 400 })
  }

  if (subjectId === member.id) {
    return NextResponse.json({ error: 'You cannot corroborate yourself' }, { status: 400 })
  }

  const subject = await prisma.member.findUnique({
    where: { id: subjectId },
    select: { id: true, origin_country: true },
  })

  if (!subject) {
    return NextResponse.json({ error: 'Subject member not found' }, { status: 404 })
  }

  if (subject.origin_country !== originCountry) {
    return NextResponse.json({ error: 'Origin country does not match this member record' }, { status: 400 })
  }

  try {
    await prisma.originCorroboration.create({
      data: {
        subject_id: subjectId,
        corroborator_id: member.id,
        origin_country: originCountry,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not record corroboration'
    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'You already corroborated this member' }, { status: 409 })
    }
    throw error
  }

  const corroborationCount = await prisma.originCorroboration.count({
    where: { subject_id: subjectId },
  })

  const score = Math.min(100, Math.round((corroborationCount / 3) * 100))

  await prisma.identityPillar.updateMany({
    where: { member_id: subjectId },
    data: {
      pillar_1_score: score,
      pillar_1_done: corroborationCount >= 3,
    },
  })

  return NextResponse.json({
    ok: true,
    corroborationCount,
    pillar1Score: score,
    pillar1Done: corroborationCount >= 3,
  })
}
