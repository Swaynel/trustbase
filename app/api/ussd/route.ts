// app/api/ussd/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSMS, ussdContinue, ussdEnd, USSD_MENUS } from '@/lib/africastalking'
import { explainIdentity, onboardingGuide } from '@/lib/cohere'
import crypto from 'crypto'

function hashPhone(phone: string) {
  return crypto.createHash('sha256').update(phone.trim()).digest('hex')
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const sessionId = formData.get('sessionId') as string
  const phoneNumber = formData.get('phoneNumber') as string
  const text = (formData.get('text') as string) || ''
  const serviceCode = formData.get('serviceCode') as string

  const supabase = createServiceClient()
  const phoneHash = hashPhone(phoneNumber)

  // Load or create session
  let session = await supabase
    .from('ussd_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single()
    .then(r => r.data)

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
    await supabase.from('ussd_sessions').upsert({
      session_id: sessionId,
      member_id: member?.id,
      phone_hash: phoneHash,
      current_menu: 'main',
      pending_data: null,
      updated_at: new Date().toISOString(),
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
    const { data: pillars } = await supabase
      .from('identity_pillars')
      .select('*')
      .eq('member_id', member?.id)
      .single()

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
          p1Score: pillars.pillar_1_score,
          p2Done: pillars.pillar_2_done,
          p2Days: pillars.p2_days_present,
          p3Done: pillars.pillar_3_done,
          p3Threads: pillars.p3_threads,
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
    const { data: chamas } = await supabase
      .from('chama_members')
      .select('chamas(id, name, balance, status)')
      .eq('member_id', member.id)
      .limit(3)

    if (!chamas?.length) {
      return new NextResponse(
        ussdEnd('You have no savings groups. Join TrustBase app to create one.'),
        { headers: { 'Content-Type': 'text/plain' } }
      )
    }

    const chama = chamas[0].chamas as any
    return new NextResponse(
      USSD_MENUS.savings(chama.balance, chama.name),
      { headers: { 'Content-Type': 'text/plain' } }
    )
  }

  // 5 → Governance vote
  if (root === '5' && member) {
    const { data: openVotes } = await supabase
      .from('votes')
      .select('id, proposal')
      .eq('status', 'open')
      .gt('window_closes_at', new Date().toISOString())
      .limit(1)
      .single()

    if (!openVotes) {
      return new NextResponse(
        ussdEnd('No open votes right now.'),
        { headers: { 'Content-Type': 'text/plain' } }
      )
    }

    if (rest[0] === '1' || rest[0] === '2') {
      const choice = rest[0] === '1' ? 'yes' : 'no'
      const weight = member.identity_level === 4 ? 3 : member.identity_level

      await supabase.from('vote_responses').upsert({
        vote_id: openVotes.id,
        member_id: member.id,
        choice,
        weight,
      })

      // Update tally
      const col = choice === 'yes' ? 'yes_weight' : 'no_weight'
      await supabase.rpc('increment_vote_weight', { vote_id: openVotes.id, col, amount: weight })

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
      const { data: activeChamas } = await supabase
        .from('chama_members')
        .select('chamas(name)')
        .eq('member_id', member.id)

      const chamaNames = activeChamas?.map((c: any) => c.chamas?.name).filter(Boolean) || []
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
