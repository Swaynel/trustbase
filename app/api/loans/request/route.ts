// app/api/loans/request/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

function serializeLoan(loan: {
  id: string
  chama_id: string | null
  borrower_id: string
  amount: { toNumber(): number }
  purpose: string | null
  status: string
  paystack_reference: string | null
  disbursed_at: Date | null
  due_at: Date | null
  repaid_at: Date | null
  created_at: Date
}) {
  return {
    ...loan,
    amount: loan.amount.toNumber(),
    disbursed_at: loan.disbursed_at?.toISOString() ?? null,
    due_at: loan.due_at?.toISOString() ?? null,
    repaid_at: loan.repaid_at?.toISOString() ?? null,
    created_at: loan.created_at.toISOString(),
  }
}

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { chamaId, amount, purpose, guarantorIds } = await req.json()

  if (!member || member.identity_level < 2) {
    return NextResponse.json({ error: 'Level 2 required to request a loan' }, { status: 403 })
  }

  if (!guarantorIds || guarantorIds.length < 2) {
    return NextResponse.json({ error: 'Minimum 2 guarantors required' }, { status: 400 })
  }

  // Get governance rule for max loan
  const rule = await prisma.governanceRule.findUnique({
    where: { key: 'max_loan_amount' },
    select: { value: true },
  })

  const maxLoan = Number(rule?.value || 5000)
  if (amount > maxLoan) {
    return NextResponse.json({ error: `Maximum loan is KES ${maxLoan}` }, { status: 400 })
  }

  // Create loan record
  const loan = await prisma.loan.create({
    data: {
      chama_id: chamaId,
      borrower_id: member.id,
      amount,
      purpose,
      status: 'guaranteeing',
      due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  // Create guarantee requests
  const guaranteeRecords = guarantorIds.map((gId: string) => ({
    loan_id: loan.id,
    guarantor_id: gId,
    stake_score: 10,
    accepted: null,
  }))

  await prisma.guarantee.createMany({ data: guaranteeRecords })

  return NextResponse.json({
    loan: serializeLoan(loan),
    message: 'Loan request created. Awaiting guarantor acceptance.',
  })
}
