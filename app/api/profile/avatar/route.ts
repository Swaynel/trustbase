import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { cloudinaryPublicId } = await req.json()

  if (!cloudinaryPublicId || typeof cloudinaryPublicId !== 'string') {
    return NextResponse.json({ error: 'A valid image id is required' }, { status: 400 })
  }

  const member = await prisma.member.update({
    where: { auth_id: user.id },
    data: { cloudinary_profile_id: cloudinaryPublicId },
    select: { cloudinary_profile_id: true },
  })

  return NextResponse.json({ ok: true, cloudinaryProfileId: member.cloudinary_profile_id })
}
