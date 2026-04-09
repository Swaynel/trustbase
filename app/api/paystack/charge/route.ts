// app/api/paystack/charge/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initializeCharge } from '@/lib/paystack'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { user, member } = await getCurrentUserWithMember()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { type, amount, chamaId, orderId, loanId, phone } = body

    // Validate amount
    if (!amount || amount < 10) {
      return NextResponse.json({ error: 'Minimum amount is KES 10' }, { status: 400 })
    }

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const chargeEmail = user.email || `${member.id}@trustbase.example.com`

    // Create a pending contribution record
    if (type === 'contribution' && chamaId) {
      const ref = `tb_contrib_${Date.now()}_${member.id.slice(0, 8)}`
      await prisma.contribution.create({
        data: {
          chama_id: chamaId,
          member_id: member.id,
          amount,
          paystack_reference: ref,
          status: 'pending',
        },
      })

      const charge = await initializeCharge({
        email: chargeEmail,
        amount: amount * 100, // to kobo
        phone,
        metadata: { type: 'contribution', memberId: member.id, chamaId, reference: ref },
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/chama/${chamaId}?payment=success`,
      })

      return NextResponse.json({ authorizationUrl: charge.data.authorization_url, reference: ref })
    }

    if (type === 'marketplace_order' && orderId) {
      const charge = await initializeCharge({
        email: chargeEmail,
        amount: amount * 100,
        phone,
        metadata: { type: 'marketplace_order', memberId: member.id, orderId },
      })
      return NextResponse.json({ authorizationUrl: charge.data.authorization_url })
    }

    if (type === 'loan_repayment' && loanId) {
      const charge = await initializeCharge({
        email: chargeEmail,
        amount: amount * 100,
        phone,
        metadata: { type: 'loan_repayment', memberId: member.id, loanId },
      })
      return NextResponse.json({ authorizationUrl: charge.data.authorization_url })
    }

    return NextResponse.json({ error: 'Unknown charge type' }, { status: 400 })
  } catch (error) {
    console.error('Paystack charge initialization failed:', error)
    const message = error instanceof Error ? error.message : 'Could not initialize charge'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
