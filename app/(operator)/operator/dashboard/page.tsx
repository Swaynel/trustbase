// app/(operator)/operator/dashboard/page.tsx
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shield } from 'lucide-react'
import OperatorActions from '@/components/operator/OperatorActions'

type DecimalValue = Parameters<typeof decimalToNumber>[0]

type RecentOpRow = {
  id: string
  member_id: string
  type: string
  amount: DecimalValue
  direction: string
  created_at: Date
}

type ServedMemberRow = {
  id: string
  display_name: string | null
}

export default async function OperatorDashboard() {
  const { user, member: operator } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!operator || !['operator', 'admin'].includes(operator.role)) redirect('/dashboard')

  const recentOpRows: RecentOpRow[] = await prisma.transaction.findMany({
    where: { operator_id: operator.id },
    orderBy: { created_at: 'desc' },
    take: 10,
    select: {
      id: true,
      member_id: true,
      type: true,
      amount: true,
      direction: true,
      created_at: true,
    },
  })

  const memberIds = Array.from(new Set(recentOpRows.map((transaction: RecentOpRow) => transaction.member_id)))
  const servedMembers: ServedMemberRow[] = memberIds.length
    ? await prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, display_name: true },
      })
    : []

  const recentOps = recentOpRows.map((transaction: RecentOpRow) => ({
    ...transaction,
    amount: decimalToNumber(transaction.amount),
    created_at: transaction.created_at.toISOString(),
    members: servedMembers.find((member: ServedMemberRow) => member.id === transaction.member_id)
      ? {
          display_name:
            servedMembers.find((member: ServedMemberRow) => member.id === transaction.member_id)?.display_name || 'Member',
        }
      : null,
  }))

  return (
    <div className="min-h-screen bg-ink-900 text-white p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-earth-400" />
          <span className="text-xs text-earth-400 uppercase tracking-wider">Node Operator</span>
        </div>
        <h1 className="font-display text-2xl text-white">{operator.display_name}</h1>
        <p className="text-xs text-earth-300 mt-0.5">Level {operator.identity_level} · Rep {Math.round(operator.reputation_score)}</p>
      </div>

      {/* Offline indicator */}
      <div className="rounded-xl bg-earth-900 border border-earth-700 p-3 mb-6 flex items-center gap-2">
        <div id="offline-indicator" className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-xs text-earth-300" id="connection-label">Connected — transactions sync automatically</span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl bg-earth-800 p-4">
          <p className="text-xs text-earth-400 mb-1">Transactions today</p>
          <p className="font-display text-2xl text-white">{recentOps.filter((t) => {
            const today = new Date(); const d = new Date(t.created_at)
            return d.toDateString() === today.toDateString()
          }).length || 0}</p>
        </div>
        <div className="rounded-xl bg-earth-800 p-4">
          <p className="text-xs text-earth-400 mb-1">Members served</p>
          <p className="font-display text-2xl text-white">{recentOps.length || 0}</p>
        </div>
      </div>

      {/* Offline-first actions */}
      <OperatorActions operatorId={operator.id} />

      {/* Recent ops */}
      {recentOps.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-earth-300 mb-3">Recent operations</h2>
          <div className="space-y-2">
            {recentOps.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl bg-earth-800 px-3 py-2.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.direction === 'in' ? 'bg-green-400' : 'bg-earth-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{t.members?.display_name || 'Member'}</p>
                  <p className="text-xs text-earth-400">{t.type.replace(/_/g, ' ')}</p>
                </div>
                <span className="text-sm text-earth-300">KES {t.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Offline sync script */}
      <script dangerouslySetInnerHTML={{ __html: `
        function updateStatus() {
          const online = navigator.onLine;
          document.getElementById('offline-indicator').style.background = online ? '#4ade80' : '#f87171';
          document.getElementById('connection-label').textContent = online
            ? 'Connected — transactions sync automatically'
            : 'Offline — transactions queued for sync';
        }
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        updateStatus();
      `}} />
    </div>
  )
}
