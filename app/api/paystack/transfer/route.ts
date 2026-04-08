// app/api/paystack/transfer/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { initiateTransfer } from '@/lib/paystack'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only admins can initiate direct transfers
  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { amount, recipientCode, reason, reference } = await req.json()

  if (!amount || !recipientCode) {
    return NextResponse.json({ error: 'amount and recipientCode required' }, { status: 400 })
  }

  try {
    const result = await initiateTransfer({
      amount: amount * 100, // to kobo
      recipientCode,
      reason: reason || 'TrustBase transfer',
      reference: reference || `tb_manual_${Date.now()}`,
    })
    return NextResponse.json({ transfer: result.data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not initiate transfer'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
