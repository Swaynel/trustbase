import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

const ALLOWED_LANGUAGES = new Set(['en', 'sw', 'fr', 'ar'])

export async function PATCH(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const body = await req.json()
  const language = typeof body.language === 'string' ? body.language : ''

  if (!ALLOWED_LANGUAGES.has(language)) {
    return NextResponse.json({ error: 'Unsupported language' }, { status: 400 })
  }

  await prisma.member.update({
    where: { id: member.id },
    data: { language },
  })

  return NextResponse.json({ ok: true, language })
}
