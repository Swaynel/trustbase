/// <reference path="../_shared/edge-runtime.d.ts" />

// supabase/functions/chama-payout/index.ts
// Runs at 02:30 EAT nightly
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SECRET_KEY =
  Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY')!
const AT_KEY = Deno.env.get('AFRICASTALKING_API_KEY')!
const AT_USER = Deno.env.get('AFRICASTALKING_USERNAME')!

if (!SUPABASE_SECRET_KEY) {
  throw new Error('Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) for admin Edge Function access.')
}

if (SUPABASE_SECRET_KEY.startsWith('postgres://') || SUPABASE_SECRET_KEY.startsWith('postgresql://')) {
  throw new Error('SUPABASE_SECRET_KEY must be an API key, not a Postgres connection URL.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)

type ChamaMemberRow = {
  member_id: string
  total_contributed: number | null
  members: Array<{
    paystack_recipient_code: string | null
    display_name: string | null
  }> | null
}

async function initiateTransfer(amount: number, recipientCode: string, reason: string, ref: string) {
  const res = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      amount: amount * 100,
      recipient: recipientCode,
      reason,
      reference: ref,
      currency: 'KES',
    }),
  })
  return res.json()
}

async function sendSMS(to: string, message: string) {
  const body = new URLSearchParams({ username: AT_USER, to, message, from: 'TrustBase' })
  await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: { 'apiKey': AT_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: body.toString(),
  })
}

Deno.serve(async () => {
  console.log('Chama payout job started')
  const now = new Date().toISOString()

  // Find active chamas with expired cycles
  const { data: maturingChamas } = await supabase
    .from('chamas')
    .select('id, name, balance')
    .eq('status', 'active')
    .lt('current_cycle_end', now)

  if (!maturingChamas?.length) {
    return new Response('No maturing chamas', { status: 200 })
  }

  let processed = 0

  for (const chama of maturingChamas) {
    try {
      // Get all members and their contributions
      const { data: members } = await supabase
        .from('chama_members')
        .select('member_id, total_contributed, members(paystack_recipient_code, display_name)')
        .eq('chama_id', chama.id)
        .eq('payout_received', false)

      const chamaMembers = (members ?? []) as ChamaMemberRow[]
      if (!chamaMembers.length) continue

      // Mark chama as in payout
      await supabase
        .from('chamas')
        .update({ status: 'payout' })
        .eq('id', chama.id)

      // Calculate proportional payout
      const totalContributed = chamaMembers.reduce(
        (sum, memberRow) => sum + (memberRow.total_contributed || 0),
        0
      )
      const payoutRatio = totalContributed > 0 ? chama.balance / totalContributed : 0

      for (const memberRow of chamaMembers) {
        const member = memberRow.members?.[0]
        if (!member?.paystack_recipient_code) continue

        const payoutAmount = Math.floor((memberRow.total_contributed || 0) * payoutRatio * 100) / 100
        if (payoutAmount < 1) continue

        const ref = `tb_payout_${chama.id}_${memberRow.member_id}_${Date.now()}`

        try {
          await initiateTransfer(
            payoutAmount,
            member.paystack_recipient_code,
            `${chama.name} savings payout`,
            ref
          )

          // Record transaction
          await supabase.from('transactions').insert({
            member_id: memberRow.member_id,
            type: 'chama_payout',
            amount: payoutAmount,
            direction: 'in',
            paystack_reference: ref,
            metadata: { chama_id: chama.id },
          })

          await supabase
            .from('chama_members')
            .update({ payout_received: true })
            .eq('chama_id', chama.id)
            .eq('member_id', memberRow.member_id)

        } catch (err) {
          console.error(`Payout failed for member ${memberRow.member_id}:`, err)
        }
      }

      // Close chama after payouts
      await supabase
        .from('chamas')
        .update({ status: 'closed' })
        .eq('id', chama.id)

      await supabase.from('chama_events').insert({
        chama_id: chama.id,
        event_type: 'cycle_completed',
        metadata: { balance: chama.balance, member_count: chamaMembers.length },
      })

      processed++
    } catch (err) {
      console.error(`Error processing chama ${chama.id}:`, err)
    }
  }

  return new Response(
    JSON.stringify({ processed, total: maturingChamas.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
