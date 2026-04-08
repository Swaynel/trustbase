// app/api/cohere/credit-narrative/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateCreditNarrative } from '@/lib/cohere'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

type StatusRow = {
  status: string
}

export async function POST() {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Return cached if generated within last 7 days
  if (member.credit_narrative && member.credit_narrative_at) {
    const age = Date.now() - new Date(member.credit_narrative_at).getTime()
    if (age < 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ narrative: member.credit_narrative, cached: true })
    }
  }

  // Gather behavioral stats
  const tenureDays = Math.floor((Date.now() - new Date(member.created_at).getTime()) / (1000 * 60 * 60 * 24))

  const contributions: StatusRow[] = await prisma.contribution.findMany({
    where: { member_id: member.id },
    select: { status: true },
  })

  const totalContributions = contributions.length
  const successfulContributions = contributions.filter((contribution: StatusRow) => contribution.status === 'success').length
  const savingsConsistencyPct = totalContributions > 0
    ? Math.round((successfulContributions / totalContributions) * 100)
    : 0

  const loans: StatusRow[] = await prisma.loan.findMany({
    where: { borrower_id: member.id },
    select: { status: true },
  })

  const totalLoans = loans.length
  const repaidLoans = loans.filter((loan: StatusRow) => loan.status === 'repaid').length
  const loanRepaymentRate = totalLoans > 0 ? Math.round((repaidLoans / totalLoans) * 100) : 100

  const txCount = await prisma.transaction.count({
    where: { member_id: member.id },
  })

  const narrative = await generateCreditNarrative({
    displayName: member.display_name || 'TrustBase Member',
    level: member.identity_level,
    tenureDays,
    savingsConsistencyPct,
    loanRepaymentRate,
    transactionCount: txCount || 0,
    language: member.language,
  })

  // Cache the narrative
  await prisma.member.update({
    where: { id: member.id },
    data: {
      credit_narrative: narrative,
      credit_narrative_at: new Date(),
    },
  })

  return NextResponse.json({ narrative, cached: false })
}
