// app/api/loans/repay/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { loanId } = await req.json()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: {
      id: true,
      amount: true,
      status: true,
      borrower_id: true,
    },
  })

  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  if (loan.borrower_id !== member.id) return NextResponse.json({ error: 'Not your loan' }, { status: 403 })
  if (loan.status !== 'disbursed') return NextResponse.json({ error: 'Loan not disbursed' }, { status: 400 })

  // Return loan amount so client can initiate Paystack charge
  return NextResponse.json({ amount: loan.amount.toNumber(), loanId })
}
