// app/api/identity/explain/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { explainIdentity } from '@/lib/cohere'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function GET() {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const pillars = await prisma.identityPillar.findFirst({
    where: { member_id: member.id },
  })

  if (!pillars) return NextResponse.json({ error: 'No pillar data' }, { status: 404 })

  const explanation = await explainIdentity({
    language: member.language,
    level: member.identity_level,
    p1Done: pillars.pillar_1_done,
    p1Score: pillars.pillar_1_score?.toNumber() ?? 0,
    p2Done: pillars.pillar_2_done,
    p2Days: pillars.p2_days_present ?? 0,
    p3Done: pillars.pillar_3_done,
    p3Threads: pillars.p3_threads ?? 0,
  })

  return NextResponse.json({ explanation })
}
