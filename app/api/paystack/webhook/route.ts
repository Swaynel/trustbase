// app/api/paystack/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, verifyTransaction } from '@/lib/paystack'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/africastalking'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-paystack-signature') || ''

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  const supabase = createServiceClient()

  // ── CHARGE SUCCESS ───────────────────────────────────────────────────────
  if (event.event === 'charge.success') {
    const { reference, metadata } = event.data
    const { type, memberId, chamaId, listingId, orderId } = metadata || {}

    // Verify independently
    const verification = await verifyTransaction(reference)
    if (verification.data.status !== 'success') {
      return NextResponse.json({ ok: false }, { status: 200 })
    }

    const amount = verification.data.amount / 100 // kobo → KES

    if (type === 'contribution' && chamaId && memberId) {
      // Update contribution record
      await supabase
        .from('contributions')
        .update({ status: 'success' })
        .eq('paystack_reference', reference)

      // Update chama balance
      await supabase.rpc('increment_chama_balance', { chama_id: chamaId, amount })

      // Update member's total_contributed in chama_members
      await supabase.rpc('increment_member_contribution', {
        chama_id: chamaId,
        member_id: memberId,
        amount,
      })

      // Log transaction
      await supabase.from('transactions').insert({
        member_id: memberId,
        type: 'contribution',
        amount,
        direction: 'out',
        paystack_reference: reference,
        metadata: { chama_id: chamaId },
      })

      // Update Pillar 3 activity thread if this is a new counterpart
      await supabase.rpc('maybe_add_activity_thread', {
        member_id: memberId,
        counterpart_type: 'chama_contribution',
      })

      // Can't un-hash the stored phone value here; use a notification-safe
      // contact channel if you add one later.
    }

    if (type === 'marketplace_order' && orderId) {
      await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId)

      await supabase.from('transactions').insert({
        member_id: memberId,
        type: 'marketplace_payment',
        amount,
        direction: 'out',
        paystack_reference: reference,
        metadata: { order_id: orderId },
      })
    }

    if (type === 'loan_repayment') {
      const { loanId } = metadata
      await supabase
        .from('loans')
        .update({ status: 'repaid', repaid_at: new Date().toISOString() })
        .eq('id', loanId)

      // Boost guarantor reputation scores
      await supabase.rpc('process_loan_repayment', { loan_id: loanId })
    }
  }

  // ── TRANSFER SUCCESS ─────────────────────────────────────────────────────
  if (event.event === 'transfer.success') {
    const { reference, metadata } = event.data
    const { type, memberId, chamaId, loanId } = metadata || {}

    const amount = event.data.amount / 100

    if (type === 'chama_payout' && chamaId) {
      await supabase.rpc('mark_chama_member_paid', {
        chama_id: chamaId,
        member_id: memberId,
      })

      await supabase.from('transactions').insert({
        member_id: memberId,
        type: 'chama_payout',
        amount,
        direction: 'in',
        paystack_reference: reference,
      })
    }

    if (type === 'loan_disbursement' && loanId) {
      await supabase
        .from('loans')
        .update({
          status: 'disbursed',
          disbursed_at: new Date().toISOString(),
          paystack_reference: reference,
        })
        .eq('id', loanId)

      await supabase.from('transactions').insert({
        member_id: memberId,
        type: 'loan_disbursement',
        amount,
        direction: 'in',
        paystack_reference: reference,
        metadata: { loan_id: loanId },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
