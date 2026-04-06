// app/(app)/chama/[id]/page.tsx
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Users, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'
import ContributeButton from '@/components/chama/ContributeButton'
import RequestLoanButton from '@/components/loans/RequestLoanButton'

export default async function ChamaDetailPage({ params }: { params: { id: string } }) {
  const { supabase, user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!member) redirect('/login')

  const { data: chama } = await supabase
    .from('chamas')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!chama) notFound()

  // Membership check
  const { data: membership } = await supabase
    .from('chama_members')
    .select('total_contributed, payout_received')
    .eq('chama_id', chama.id)
    .eq('member_id', member.id)
    .single()

  // All members with names
  const { data: membersData } = await supabase
    .from('chama_members')
    .select('total_contributed, payout_received, members(id, display_name, identity_level)')
    .eq('chama_id', chama.id)

  const chamaMemberList = membersData?.map((m: any) => ({
    ...m.members,
    total_contributed: m.total_contributed,
    payout_received: m.payout_received,
  })).filter(Boolean) || []

  // Recent contributions
  const { data: contributions } = await supabase
    .from('contributions')
    .select('id, amount, status, created_at, members(display_name)')
    .eq('chama_id', chama.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const isMember = !!membership
  const cycleProgress = chama.current_cycle_end
    ? Math.min(100, Math.floor((Date.now() - new Date(chama.created_at).getTime()) /
        (chama.cycle_days * 86400000) * 100))
    : 0

  const STATUS_COLORS: Record<string, string> = {
    forming: 'bg-amber-100 text-amber-700',
    active:  'bg-green-100 text-green-700',
    payout:  'bg-blue-100 text-blue-700',
    closed:  'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-earth-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-earth-600" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-ink-900">{chama.name}</h1>
              <span className={`badge ${STATUS_COLORS[chama.status]}`}>{chama.status}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-earth-400">Pool balance</p>
            <p className="font-display text-3xl text-earth-600">KES {chama.balance.toLocaleString()}</p>
          </div>
        </div>

        {chama.description && (
          <p className="text-sm text-earth-600 mb-4">{chama.description}</p>
        )}

        <div className="grid grid-cols-3 gap-3 text-center py-3 border-y border-earth-100 mb-4">
          <div>
            <p className="text-xs text-earth-400">Contribution</p>
            <p className="font-medium text-ink-900">KES {chama.contribution_amount}</p>
          </div>
          <div>
            <p className="text-xs text-earth-400">Cycle</p>
            <p className="font-medium text-ink-900">{chama.cycle_days} days</p>
          </div>
          <div>
            <p className="text-xs text-earth-400">Members</p>
            <p className="font-medium text-ink-900">{chamaMemberList.length}</p>
          </div>
        </div>

        {/* Cycle progress */}
        {chama.status === 'active' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-earth-400 mb-1">
              <span>Cycle progress</span>
              <span>{cycleProgress}%</span>
            </div>
            <div className="h-2 bg-earth-100 rounded-full overflow-hidden">
              <div className="h-full bg-earth-500 rounded-full" style={{ width: `${cycleProgress}%` }} />
            </div>
          </div>
        )}

        {/* My contribution */}
        {membership && (
          <div className="flex items-center justify-between bg-earth-50 rounded-xl p-3 mb-4">
            <div>
              <p className="text-xs text-earth-400">My total contributed</p>
              <p className="font-medium text-ink-900">KES {membership.total_contributed.toLocaleString()}</p>
            </div>
            {membership.payout_received && (
              <span className="badge bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3" /> Payout received
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        {isMember && chama.status === 'active' && (
          <div className="flex gap-3">
            <ContributeButton chamaId={chama.id} amount={chama.contribution_amount} />
            {member.identity_level >= 2 && (
              <RequestLoanButton chamaId={chama.id} memberList={chamaMemberList} currentMemberId={member.id} />
            )}
          </div>
        )}
      </div>

      {/* Members */}
      <div className="card">
        <h2 className="font-display text-lg text-ink-900 mb-4">Members ({chamaMemberList.length})</h2>
        <div className="space-y-2">
          {chamaMemberList.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-earth-50">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-earth-200 flex items-center justify-center text-xs font-medium text-earth-700">
                {(m.display_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-800">{m.display_name || 'Anonymous'}</p>
                <p className="text-xs text-earth-400">Level {m.identity_level}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-earth-500">KES {m.total_contributed.toLocaleString()}</p>
                {m.payout_received && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent contributions */}
      {contributions && contributions.length > 0 && (
        <div className="card">
          <h2 className="font-display text-lg text-ink-900 mb-4">Recent contributions</h2>
          <div className="space-y-2">
            {contributions.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-earth-50">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.status === 'success' ? 'bg-green-400' : c.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'}`} />
                <div className="flex-1">
                  <p className="text-sm text-ink-800">{c.members?.display_name || 'Member'}</p>
                  <p className="text-xs text-earth-400">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-sm font-medium text-earth-700">KES {c.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
