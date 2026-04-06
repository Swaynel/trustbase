// app/api/paystack/recipient/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createRecipient } from '@/lib/paystack'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Return existing recipient code if already registered
  if (member.paystack_recipient_code) {
    return NextResponse.json({ recipientCode: member.paystack_recipient_code })
  }

  const { phone } = await req.json()
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  try {
    const result = await createRecipient({
      name: member.display_name || 'TrustBase Member',
      phone,
    })

    const recipientCode = result.data.recipient_code

    // Store on member record
    await prisma.member.update({
      where: { id: member.id },
      data: { paystack_recipient_code: recipientCode },
    })

    return NextResponse.json({ recipientCode })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
