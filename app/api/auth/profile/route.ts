import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ALLOWED_LANGUAGES = new Set(['en', 'sw', 'fr', 'ar'])

export const runtime = 'nodejs'

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function formatProfileCreationError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : ''
  const message = error instanceof Error ? error.message : 'Could not create profile'

  if (code === 'ENETUNREACH' || message.includes('ENETUNREACH')) {
    return 'Prisma could not reach the Supabase database. Your SUPABASE_DB_URL is likely using the direct IPv6-only host. Replace it with the Supabase Session pooler connection string from Dashboard > Connect.'
  }

  return message
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser()

  let user = cookieUser

  if (!user) {
    const authorization = req.headers.get('authorization')
    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : ''

    if (accessToken) {
      const adminSupabase = createServiceClient()
      const {
        data: { user: tokenUser },
      } = await adminSupabase.auth.getUser(accessToken)
      user = tokenUser ?? null
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

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
    const { prisma } = await import('@/lib/prisma')
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
    console.error('Profile creation failed:', error)
    const message = formatProfileCreationError(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
