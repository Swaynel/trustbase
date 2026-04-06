// app/api/loans/guarantee/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initiateTransfer } from '@/lib/paystack'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { loanId, accept } = await req.json()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Update guarantee record
  const updatedGuarantees = await prisma.guarantee.updateMany({
    where: {
      loan_id: loanId,
      guarantor_id: member.id,
    },
    data: { accepted: accept },
  })

  if (updatedGuarantees.count === 0) {
    return NextResponse.json({ error: 'Guarantee record not found' }, { status: 404 })
  }

  // Check if we have majority acceptance
  const allGuarantees = await prisma.guarantee.findMany({
    where: { loan_id: loanId },
    select: { accepted: true },
  })

  const accepted = allGuarantees.filter((guarantee) => guarantee.accepted === true).length
  const total = allGuarantees.length
  const rejected = allGuarantees.filter((guarantee) => guarantee.accepted === false).length

  // Majority rejected → cancel loan
  if (rejected > total / 2) {
    await prisma.loan.update({
      where: { id: loanId },
      data: { status: 'requested' },
    })
    return NextResponse.json({ message: 'Guarantee rejected. Loan cannot proceed.' })
  }

  // All accepted OR majority accepted → approve and disburse
  if (accepted >= Math.ceil(total / 2)) {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        amount: true,
        borrower_id: true,
      },
    })

    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

    await prisma.loan.update({
      where: { id: loanId },
      data: { status: 'approved' },
    })

    // Disburse via Paystack transfer
    const borrower = await prisma.member.findUnique({
      where: { id: loan.borrower_id },
      select: { paystack_recipient_code: true },
    })

    if (borrower?.paystack_recipient_code) {
      try {
        await initiateTransfer({
          amount: loan.amount.toNumber() * 100, // to kobo
          recipientCode: borrower.paystack_recipient_code,
          reason: `TrustBase loan disbursement`,
          reference: `tb_loan_${loanId}_${Date.now()}`,
        })
        // Webhook will update loan status to 'disbursed'
      } catch (e) {
        console.error('Transfer failed:', e)
      }
    }

    return NextResponse.json({ message: 'Loan approved. Disbursement initiated.' })
  }

  return NextResponse.json({ message: `Guarantee recorded. ${accepted}/${total} accepted.` })
}
