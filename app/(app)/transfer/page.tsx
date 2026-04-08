// app/(app)/transfer/page.tsx
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeftRight, Lock } from 'lucide-react'
import AcceptAgentButton from '@/components/transfer/AcceptAgentButton'
import NewTransferForm from '@/components/transfer/NewTransferForm'

const STATUS_COLORS: Record<string, string> = {
  open:      'bg-amber-100 text-amber-700',
  matched:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  expired:   'bg-gray-100 text-gray-400',
  cancelled: 'bg-red-100 text-red-600',
}

type DecimalValue = Parameters<typeof decimalToNumber>[0]

type TransferRequestRow = {
  id: string
  sender_id: string
  agent_id: string | null
  amount: DecimalValue
  destination_city: string
  status: string
  created_at: Date
  expires_at: Date
}

type RelatedMemberRow = {
  id: string
  display_name: string | null
}

type SerializedTransfer = Omit<TransferRequestRow, 'amount' | 'created_at' | 'expires_at'> & {
  amount: number
  created_at: string
  expires_at: string
  expires_in_hours?: number
  members: { display_name: string } | null
}

export default async function TransferPage() {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!member) redirect('/login')

  if (member.identity_level < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="section-title">Value Transfer</h1>
          <p className="section-sub">Send money across cities through trusted community agents</p>
        </div>
        <div className="card text-center py-16">
          <Lock className="w-12 h-12 text-earth-300 mx-auto mb-3" />
          <h2 className="font-display text-xl text-ink-900 mb-2">Level 2 required</h2>
          <p className="text-sm text-earth-500">Complete 2 identity pillars to use cross-city transfers.</p>
        </div>
      </div>
    )
  }

  const [myTransferRowsRaw, agentRequestRowsRaw] = await Promise.all([
    prisma.transferRequest.findMany({
      where: { sender_id: member.id },
      orderBy: { created_at: 'desc' },
      take: 10,
    }),
    prisma.transferRequest.findMany({
      where: {
        status: 'open',
        sender_id: { not: member.id },
      },
      take: 5,
    }),
  ])

  const myTransferRows: TransferRequestRow[] = myTransferRowsRaw
  const agentRequestRows: TransferRequestRow[] = agentRequestRowsRaw

  const relatedMemberIds = Array.from(
    new Set([
      ...myTransferRows.map((row: TransferRequestRow) => row.agent_id).filter((value): value is string => Boolean(value)),
      ...agentRequestRows.map((row: TransferRequestRow) => row.sender_id),
    ])
  )

  const relatedMembers: RelatedMemberRow[] = relatedMemberIds.length
    ? await prisma.member.findMany({
        where: { id: { in: relatedMemberIds } },
        select: { id: true, display_name: true },
      })
    : []

  const relatedMemberMap = new Map<string, string>(
    relatedMembers.map((row: RelatedMemberRow) => [row.id, row.display_name || 'Member'])
  )
  const now = new Date()

  const myTransfers: SerializedTransfer[] = myTransferRows.map((transfer: TransferRequestRow) => ({
    ...transfer,
    amount: decimalToNumber(transfer.amount),
    created_at: transfer.created_at.toISOString(),
    expires_at: transfer.expires_at.toISOString(),
    members: transfer.agent_id
      ? { display_name: relatedMemberMap.get(transfer.agent_id) || 'Member' }
      : null,
  }))

  const agentRequests: SerializedTransfer[] = agentRequestRows.map((transfer: TransferRequestRow) => ({
    ...transfer,
    amount: decimalToNumber(transfer.amount),
    created_at: transfer.created_at.toISOString(),
    expires_at: transfer.expires_at.toISOString(),
    expires_in_hours: Math.ceil((new Date(transfer.expires_at).getTime() - now.getTime()) / 3600000),
    members: { display_name: relatedMemberMap.get(transfer.sender_id) || 'Member' },
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Value Transfer</h1>
        <p className="section-sub">Cross-city transfers through trusted community agents</p>
      </div>

      {/* How it works */}
      <div className="card bg-earth-50 border-earth-200">
        <p className="text-xs font-medium text-earth-700 mb-3">How the community transfer network works</p>
        <div className="grid md:grid-cols-4 gap-2 text-xs text-earth-600">
          <div className="flex gap-2">
            <span className="font-mono text-earth-400 flex-shrink-0">01</span>
            You request to send KES X to City Y
          </div>
          <div className="flex gap-2">
            <span className="font-mono text-earth-400 flex-shrink-0">02</span>
            A trusted agent in City Y is matched
          </div>
          <div className="flex gap-2">
            <span className="font-mono text-earth-400 flex-shrink-0">03</span>
            Agent confirms and notifies the recipient
          </div>
          <div className="flex gap-2">
            <span className="font-mono text-earth-400 flex-shrink-0">04</span>
            Internal ledger settles — no formal money movement
          </div>
        </div>
      </div>

      {/* Internal balance */}
      <div className="card bg-ink-900 text-white">
        <p className="text-xs text-earth-300 mb-1">Internal balance</p>
        <p className="font-display text-3xl">KES {member.internal_balance.toLocaleString()}</p>
        <p className="text-xs text-earth-400 mt-1">Available for internal transfers</p>
      </div>

      {/* New transfer form */}
      <div className="card">
        <h2 className="font-display text-lg text-ink-900 mb-4">Send a transfer</h2>
        <NewTransferForm memberId={member.id} balance={member.internal_balance} />
      </div>

      {/* Agent opportunities */}
      {agentRequests.length > 0 && (
        <div className="card">
          <h2 className="font-display text-lg text-ink-900 mb-1">Act as an agent</h2>
          <p className="text-xs text-earth-500 mb-4">
            Accept these requests and earn a small fee to your internal balance
          </p>
          <div className="space-y-3">
            {agentRequests.map((t) => (
              <AgentRequestCard key={t.id} transfer={t} agentId={member.id} />
            ))}
          </div>
        </div>
      )}

      {/* My transfer history */}
      {myTransfers.length > 0 && (
        <div className="card">
          <h2 className="font-display text-lg text-ink-900 mb-4">Transfer history</h2>
          <div className="space-y-2">
            {myTransfers.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-earth-50">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-earth-100 flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4 text-earth-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-800">
                    KES {t.amount.toLocaleString()} → {t.destination_city}
                  </p>
                  <p className="text-xs text-earth-400">
                    {t.members?.display_name ? `Agent: ${t.members.display_name}` : 'Awaiting agent'}
                    {' · '}{new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`badge text-xs flex-shrink-0 ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-400'}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AgentRequestCard({ transfer, agentId }: { transfer: SerializedTransfer; agentId: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-earth-200 bg-earth-50">
      <div className="flex-1">
        <p className="text-sm font-medium text-ink-900">
          {transfer.members?.display_name || 'Member'} wants to send KES {transfer.amount.toLocaleString()}
        </p>
        <p className="text-xs text-earth-500 mt-0.5">
          To: {transfer.destination_city} · Expires in {transfer.expires_in_hours ?? 0}h
        </p>
      </div>
      <AcceptAgentButton transferId={transfer.id} agentId={agentId} />
    </div>
  )
}
