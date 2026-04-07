// app/api/cohere/onboarding/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { onboardingGuide } from '@/lib/cohere'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

type MembershipRow = {
  chama_id: string
}

type ChamaNameRow = {
  name: string | null
}

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question } = await req.json()
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 })

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const activeMemberships: MembershipRow[] = await prisma.chamaMember.findMany({
    where: { member_id: member.id },
    select: { chama_id: true },
    take: 5,
  })

  const activeChamas: ChamaNameRow[] = activeMemberships.length > 0
    ? await prisma.chama.findMany({
        where: {
          id: {
            in: activeMemberships.map((membership: MembershipRow) => membership.chama_id),
          },
        },
        select: { name: true },
      })
    : []

  const chamaNames = activeChamas
    .map((chama: ChamaNameRow) => chama.name)
    .filter((name): name is string => Boolean(name))

  const answer = await onboardingGuide({
    question,
    language: member.language,
    level: member.identity_level,
    activeChamas: chamaNames,
  })

  return NextResponse.json({ answer })
}
