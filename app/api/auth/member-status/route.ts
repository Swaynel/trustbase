import { NextResponse } from 'next/server'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function GET() {
  const { user, member } = await getCurrentUserWithMember()

  return NextResponse.json({
    authenticated: Boolean(user),
    hasMemberProfile: Boolean(member),
    memberId: member?.id ?? null,
  })
}
