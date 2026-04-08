// app/api/transfer/request/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

type DecimalLike = { toNumber(): number }

type TransferRow = {
  id: string
  sender_id: string
  amount: DecimalLike
  destination_city: string
  agent_id: string | null
  status: string
  expires_at: Date
  created_at: Date
}

type RequestTransferTx = {
  member: Pick<typeof prisma.member, 'updateMany'>
  transferRequest: Pick<typeof prisma.transferRequest, 'create'>
  transaction: Pick<typeof prisma.transaction, 'create'>
}

function serializeTransfer(transfer: TransferRow) {
  return {
    ...transfer,
    amount: transfer.amount.toNumber(),
    expires_at: transfer.expires_at.toISOString(),
    created_at: transfer.created_at.toISOString(),
  }
}

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount, destinationCity } = await req.json()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  if (member.internal_balance < amount) {
    return NextResponse.json({ error: 'Insufficient internal balance' }, { status: 400 })
  }

  // Find an available agent in destination city with sufficient balance
  // Simple greedy: pick highest-balance agent in that city
  const agent = await prisma.member.findFirst({
    where: {
      role: 'operator',
      internal_balance: { gte: amount },
    },
    orderBy: { internal_balance: 'desc' },
    select: { id: true, display_name: true },
  })

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  let transfer

  try {
    transfer = await prisma.$transaction(async (tx: RequestTransferTx) => {
      const debitedMember = await tx.member.updateMany({
        where: {
          id: member.id,
          internal_balance: { gte: amount },
        },
        data: {
          internal_balance: { decrement: amount },
        },
      })

      if (debitedMember.count === 0) {
        throw new Error('Insufficient internal balance')
      }

      const createdTransfer = await tx.transferRequest.create({
        data: {
          sender_id: member.id,
          amount,
          destination_city: destinationCity,
          agent_id: agent?.id || null,
          status: agent ? 'matched' : 'open',
          expires_at: expiresAt,
        },
      })

      await tx.transaction.create({
        data: {
          member_id: member.id,
          type: 'transfer_sent',
          amount,
          direction: 'out',
          metadata: {
            destination_city: destinationCity,
            transfer_id: createdTransfer.id,
          },
        },
      })

      return createdTransfer
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create transfer'
    const status = message === 'Insufficient internal balance' ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }

  const message = agent
    ? `Transfer matched. Agent ${agent.display_name} will contact the recipient in ${destinationCity}.`
    : `Transfer queued. We'll notify you when an agent accepts in ${destinationCity}.`

  return NextResponse.json({ transfer: serializeTransfer(transfer), message })
}

export async function GET() {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const transfers: TransferRow[] = await prisma.transferRequest.findMany({
    where: { sender_id: member.id },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({
    transfers: transfers.map((transfer: TransferRow) => serializeTransfer(transfer)),
  })
}

export async function PATCH(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const { transferId, agentId, action } = await req.json()

  if (action === 'accept') {
    const transfer = await prisma.transferRequest.findFirst({
      where: {
        id: transferId,
        status: 'open',
      },
    })

    if (!transfer) return NextResponse.json({ error: 'Transfer not found or already matched' }, { status: 404 })

    // Credit agent fee (0.5% of amount, from governance rule)
    const assignedAgentId = agentId || member.id
    const agentFee = transfer.amount.toNumber() * 0.005

    await prisma.$transaction([
      prisma.transferRequest.update({
        where: { id: transferId },
        data: { agent_id: assignedAgentId, status: 'matched' },
      }),
      prisma.member.update({
        where: { id: assignedAgentId },
        data: {
          internal_balance: { increment: agentFee },
        },
      }),
      prisma.transaction.create({
        data: {
          member_id: assignedAgentId,
          type: 'agent_fee',
          amount: agentFee,
          direction: 'in',
          metadata: { transfer_id: transferId },
        },
      }),
    ])

    return NextResponse.json({ message: 'Transfer accepted. Recipient will be notified.' })
  }

  if (action === 'complete') {
    const transfer = await prisma.transferRequest.findUnique({
      where: { id: transferId },
      select: { amount: true, agent_id: true },
    })

    if (!transfer) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })

    await prisma.transferRequest.update({
      where: { id: transferId },
      data: { status: 'completed' },
    })

    if (transfer.agent_id) {
      // Credit recipient's internal balance via agent
      await prisma.transaction.create({
        data: {
          member_id: transfer.agent_id,
          type: 'transfer_received',
          amount: transfer.amount.toNumber(),
          direction: 'out',
          metadata: { transfer_id: transferId },
        },
      })
    }

    return NextResponse.json({ message: 'Transfer completed.' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
