// app/api/paystack/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, verifyTransaction } from '@/lib/paystack'
import { prisma } from '@/lib/prisma'

type GuaranteeRow = {
  id: string
  guarantor_id: string
  stake_score: { toNumber(): number }
}

async function processLoanRepayment(loanId: string) {
  const guarantees: GuaranteeRow[] = await prisma.guarantee.findMany({
    where: {
      loan_id: loanId,
      accepted: true,
    },
    select: {
      id: true,
      guarantor_id: true,
      stake_score: true,
    },
  })

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { borrower_id: true },
  })

  await prisma.$transaction([
    ...guarantees.map((guarantee: GuaranteeRow) =>
      prisma.$executeRaw`
        UPDATE public.members
        SET reputation_score = LEAST(100, reputation_score + ${guarantee.stake_score.toNumber() * 0.5})
        WHERE id = ${guarantee.guarantor_id}::uuid
      `
    ),
    ...guarantees.map((guarantee: GuaranteeRow) =>
      prisma.guarantee.update({
        where: { id: guarantee.id },
        data: { outcome: 'returned' },
      })
    ),
    ...(loan?.borrower_id
      ? [
          prisma.$executeRaw`
            UPDATE public.members
            SET reputation_score = LEAST(100, reputation_score + 5)
            WHERE id = ${loan.borrower_id}::uuid
          `,
        ]
      : []),
  ])
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-paystack-signature') || ''

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)

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
      await prisma.$transaction([
        prisma.contribution.updateMany({
          where: { paystack_reference: reference },
          data: { status: 'success' },
        }),
        prisma.chama.update({
          where: { id: chamaId },
          data: {
            balance: { increment: amount },
          },
        }),
        prisma.chamaMember.update({
          where: {
            chama_id_member_id: {
              chama_id: chamaId,
              member_id: memberId,
            },
          },
          data: {
            total_contributed: { increment: amount },
          },
        }),
        prisma.transaction.create({
          data: {
            member_id: memberId,
            type: 'contribution',
            amount,
            direction: 'out',
            paystack_reference: reference,
            metadata: { chama_id: chamaId },
          },
        }),
      ])

      // Can't un-hash the stored phone value here; use a notification-safe
      // contact channel if you add one later.
    }

    if (type === 'marketplace_order' && orderId && memberId) {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId },
          data: { status: 'paid' },
        }),
        prisma.transaction.create({
          data: {
            member_id: memberId,
            type: 'marketplace_payment',
            amount,
            direction: 'out',
            paystack_reference: reference,
            metadata: { order_id: orderId },
          },
        }),
      ])
    }

    if (type === 'loan_repayment') {
      const { loanId } = metadata

      if (loanId) {
        await prisma.loan.update({
          where: { id: loanId },
          data: { status: 'repaid', repaid_at: new Date() },
        })

        await processLoanRepayment(loanId)
      }
    }
  }

  // ── TRANSFER SUCCESS ─────────────────────────────────────────────────────
  if (event.event === 'transfer.success') {
    const { reference, metadata } = event.data
    const { type, memberId, chamaId, loanId } = metadata || {}

    const amount = event.data.amount / 100

    if (type === 'chama_payout' && chamaId && memberId) {
      await prisma.$transaction(async (tx) => {
        await tx.chamaMember.update({
          where: {
            chama_id_member_id: {
              chama_id: chamaId,
              member_id: memberId,
            },
          },
          data: { payout_received: true },
        })

        const unpaidMembers = await tx.chamaMember.count({
          where: {
            chama_id: chamaId,
            payout_received: false,
          },
        })

        if (unpaidMembers === 0) {
          await tx.chama.update({
            where: { id: chamaId },
            data: { status: 'closed' },
          })
        }

        await tx.transaction.create({
          data: {
            member_id: memberId,
            type: 'chama_payout',
            amount,
            direction: 'in',
            paystack_reference: reference,
          },
        })
      })
    }

    if (type === 'loan_disbursement' && loanId && memberId) {
      await prisma.$transaction([
        prisma.loan.update({
          where: { id: loanId },
          data: {
            status: 'disbursed',
            disbursed_at: new Date(),
            paystack_reference: reference,
          },
        }),
        prisma.transaction.create({
          data: {
            member_id: memberId,
            type: 'loan_disbursement',
            amount,
            direction: 'in',
            paystack_reference: reference,
            metadata: { loan_id: loanId },
          },
        }),
      ])
    }
  }

  return NextResponse.json({ ok: true })
}
