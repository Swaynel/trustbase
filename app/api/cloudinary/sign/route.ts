// app/api/cloudinary/sign/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSignedUploadParams } from '@/lib/cloudinary'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { folder = 'trustbase/listings', publicId } = await req.json()

  // Only allow uploads to permitted folders
  const allowedFolders = ['trustbase/listings', 'trustbase/profiles']
  if (!allowedFolders.includes(folder)) {
    return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
  }

  const params = generateSignedUploadParams(folder, publicId)
  return NextResponse.json(params)
}
