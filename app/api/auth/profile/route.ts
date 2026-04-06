import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const ALLOWED_LANGUAGES = new Set(['en', 'sw', 'fr', 'ar'])

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const displayName = typeof body.name === 'string' ? body.name.trim() : ''
  const language = typeof body.language === 'string' ? body.language : 'en'
  const originCountry = typeof body.country === 'string' ? body.country.trim() : ''
  const rawPhone = typeof user.phone === 'string' && user.phone.trim() ? user.phone : String(body.phone ?? '').trim()

  if (!displayName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  if (!rawPhone) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  if (!ALLOWED_LANGUAGES.has(language)) {
    return NextResponse.json({ error: 'Unsupported language' }, { status: 400 })
  }

  try {
    const member = await prisma.member.upsert({
      where: { auth_id: user.id },
      update: {
        display_name: displayName,
        language,
        origin_country: originCountry || null,
        phone_hash: sha256Hex(rawPhone),
      },
      create: {
        auth_id: user.id,
        display_name: displayName,
        language,
        origin_country: originCountry || null,
        phone_hash: sha256Hex(rawPhone),
        identity_level: 0,
        role: 'member',
      },
      select: { id: true },
    })

    return NextResponse.json({ memberId: member.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create profile'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
