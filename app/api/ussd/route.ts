// app/api/ussd/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { sendSMS, ussdContinue, ussdEnd, USSD_MENUS } from '@/lib/africastalking'
import { explainIdentity, onboardingGuide } from '@/lib/cohere'
import crypto from 'crypto'

type MembershipRow = {
  chama_id: string
}

type ChamaBalanceRow = {
  id: string
  name: string
  balance: Parameters<typeof decimalToNumber>[0]
  status: string
}

type ChamaNameRow = {
  name: string | null
}

type VoteResponseRow = {
  choice: string
  weight: Parameters<typeof decimalToNumber>[0]
}

function hashPhone(phone: string) {
  return crypto.createHash('sha256').update(phone.trim()).digest('hex')
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const sessionId = formData.get('sessionId') as string
  const phoneNumber = formData.get('phoneNumber') as string
  const text = (formData.get('text') as string) || ''

  const phoneHash = hashPhone(phoneNumber)

  const inputs = text ? text.split('*') : []
  const lastInput = inputs[inputs.length - 1] || ''

  // Find member by phone hash
  const member = await prisma.member.findUnique({
    where: { phone_hash: phoneHash },
    select: {
      id: true,
      display_name: true,
      identity_level: true,
      language: true,
    },
  })

  // ── MAIN MENU ────────────────────────────────────────────────────────────
  if (!text || text === '') {
    await prisma.ussdSession.upsert({
      where: { session_id: sessionId },
      update: {
        member_id: member?.id ?? null,
        phone_hash: phoneHash,
        current_menu: 'main',
        updated_at: new Date(),
      },
      create: {
        session_id: sessionId,
        member_id: member?.id ?? null,
        phone_hash: phoneHash,
        current_menu: 'main',
      },
    })

    if (!member) {
      return new NextResponse(
        ussdContinue('Welcome to TrustBase\n1. Register\n2. Learn more'),
        { headers: { 'Content-Type': 'text/plain' } }
      )
    }

    return new NextResponse(
      USSD_MENUS.main(member.display_name || '', member.identity_level),
      { headers: { 'Content-Type': 'text/plain' } }
    )
  }

  // ── ROUTE BY MENU PATH ───────────────────────────────────────────────────
  const path = text.split('*')
  const [root, ...rest] = path

  // 1 → Identity
  if (root === '1') {
    const pillars = member
      ? await prisma.identityPillar.findFirst({
          where: { member_id: member.id },
        })
      : null

    if (!pillars || !rest.length) {
      return new NextResponse(
        USSD_MENUS.identity(
          pillars?.pillar_1_done || false,
          pillars?.p2_days_present || 0,
          pillars?.p3_threads || 0,
          member?.identity_level || 0
        ),
        { headers: { 'Content-Type': 'text/plain' } }
      )
    }

    // 1 → 99 = explain via Cohere
    if (rest[0] === '99' && member && pillars) {
      try {
        const explanation = await explainIdentity({
          language: member.language,
          level: member.identity_level,
          p1Done: pillars.pillar_1_done,
          p1Score: decimalToNumber(pillars.pillar_1_score),
          p2Done: pillars.pillar_2_done,
          p2Days: pillars.p2_days_present ?? 0,
          p3Done: pillars.pillar_3_done,
          p3Threads: pillars.p3_threads ?? 0,
        })
        await sendSMS(phoneNumber, explanation.slice(0, 160))
        return new NextResponse(
          ussdEnd('Explanation sent to your phone via SMS.'),
          { headers: { 'Content-Type': 'text/plain' } }
        )
      } catch {
        return new NextResponse(
          ussdEnd('Could not generate explanation. Try again later.'),
          { headers: { 'Content-Type': 'text/plain' } }
        )
      }
    }
  }

  // 2 → Savings group balance
  if (root === '2' && member) {
    const memberships: MembershipRow[] = await prisma.chamaMember.findMany({
      where: { member_id: member.id },
      take: 3,
      select: { chama_id: true },
    })

    const chamas: ChamaBalanceRow[] = memberships.length
      ? await prisma.chama.findMany({
          where: { id: { in: memberships.map((membership: MembershipRow) => membership.chama_id) } },
          select: { id: true, name: true, balance: true, status: true },
        })
      : []

    if (!chamas.length) {
      return new NextResponse(
        ussdEnd('You have no savings groups. Join TrustBase app to create one.'),
        { headers: { 'Content-Type': 'text/plain' } }
      )
    }

    const chama = chamas[0]
    return new NextResponse(
      USSD_MENUS.savings(decimalToNumber(chama.balance), chama.name),
      { headers: { 'Content-Type': 'text/plain' } }
    )
  }

  // 5 → Governance vote
  if (root === '5' && member) {
    const openVotes = await prisma.vote.findFirst({
      where: {
        status: 'open',
        window_closes_at: { gt: new Date() },
      },
      select: { id: true, proposal: true },
      orderBy: { window_closes_at: 'asc' },
    })

    if (!openVotes) {
      return new NextResponse(
        ussdEnd('No open votes right now.'),
        { headers: { 'Content-Type': 'text/plain' } }
      )
    }

    if (rest[0] === '1' || rest[0] === '2') {
      const choice = rest[0] === '1' ? 'yes' : 'no'
      const weight = member.identity_level === 4 ? 3 : member.identity_level

      await prisma.voteResponse.upsert({
        where: {
          vote_id_member_id: {
            vote_id: openVotes.id,
            member_id: member.id,
          },
        },
        update: { choice, weight },
        create: {
          vote_id: openVotes.id,
          member_id: member.id,
          choice,
          weight,
        },
      })

      const allResponses: VoteResponseRow[] = await prisma.voteResponse.findMany({
        where: { vote_id: openVotes.id },
        select: { choice: true, weight: true },
      })

      const yes = allResponses
        .filter((response: VoteResponseRow) => response.choice === 'yes')
        .reduce((sum, response) => sum + decimalToNumber(response.weight), 0)
      const no = allResponses
        .filter((response: VoteResponseRow) => response.choice === 'no')
        .reduce((sum, response) => sum + decimalToNumber(response.weight), 0)

      await prisma.vote.update({
        where: { id: openVotes.id },
        data: {
          yes_weight: yes,
          no_weight: no,
        },
      })

      return new NextResponse(
        ussdEnd(`Vote recorded: ${choice.toUpperCase()}. Thank you.`),
        { headers: { 'Content-Type': 'text/plain' } }
      )
    }

    return new NextResponse(
      USSD_MENUS.vote(openVotes.proposal),
      { headers: { 'Content-Type': 'text/plain' } }
    )
  }

  // 0 → Help (triggers Cohere onboarding)
  if (root === '0' && member) {
    try {
      const activeMemberships: MembershipRow[] = await prisma.chamaMember.findMany({
        where: { member_id: member.id },
        select: { chama_id: true },
      })

      const activeChamas: ChamaNameRow[] = activeMemberships.length
        ? await prisma.chama.findMany({
            where: { id: { in: activeMemberships.map((membership: MembershipRow) => membership.chama_id) } },
            select: { name: true },
          })
        : []

      const chamaNames = activeChamas
        .map((chama: ChamaNameRow) => chama.name)
        .filter((name): name is string => Boolean(name))
      const guide = await onboardingGuide({
        question: 'What is TrustBase and how do I get started?',
        language: member.language,
        level: member.identity_level,
        activeChamas: chamaNames,
      })

      await sendSMS(phoneNumber, guide.slice(0, 160))
      return new NextResponse(
        ussdEnd('Help guide sent to your phone via SMS.'),
        { headers: { 'Content-Type': 'text/plain' } }
      )
    } catch {
      return new NextResponse(
        ussdEnd('Visit trustbase.app for help.'),
        { headers: { 'Content-Type': 'text/plain' } }
      )
    }
  }

  return new NextResponse(
    ussdEnd('Invalid option. Please try again.'),
    { headers: { 'Content-Type': 'text/plain' } }
  )
}
