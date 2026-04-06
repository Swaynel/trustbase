// app/(app)/chama/page.tsx
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus, TrendingUp, Lock } from 'lucide-react'
import CreateChamaModal from '@/components/chama/CreateChamaModal'

export default async function ChamaPage() {
  const { supabase, user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!member) redirect('/login')

  const { data: myChamas } = await supabase
    .from('chama_members')
    .select(`
      total_contributed,
      payout_received,
      chamas(id, name, balance, status, contribution_amount, cycle_days, created_by)
    `)
    .eq('member_id', member.id)

  const chamas = myChamas?.map((c: any) => ({
    ...c.chamas,
    total_contributed: c.total_contributed,
    payout_received: c.payout_received,
  })).filter(Boolean) || []

  // All active chamas for discovery (not member of)
  const myIds = chamas.map((c: any) => c.id)
  const { data: openChamas } = await supabase
    .from('chamas')
    .select('id, name, balance, status, contribution_amount')
    .eq('status', 'forming')
    .not('id', 'in', myIds.length ? `(${myIds.map((id: string) => `'${id}'`).join(',')})` : `('')`)
    .limit(6)

  const STATUS_COLORS: Record<string, string> = {
    forming: 'bg-amber-100 text-amber-700',
    active:  'bg-green-100 text-green-700',
    payout:  'bg-blue-100 text-blue-700',
    closed:  'bg-gray-100 text-gray-500',
  }

  if (member.identity_level < 1) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="section-title">Savings Groups</h1>
          <p className="section-sub">Digital chamas — save together, grow together</p>
        </div>
        <div className="card text-center py-16">
          <Lock className="w-12 h-12 text-earth-300 mx-auto mb-3" />
          <h2 className="font-display text-xl text-ink-900 mb-2">Level 1 required</h2>
          <p className="text-sm text-earth-500">Complete one identity pillar to join savings groups.</p>
          <Link href="/dashboard" className="btn-primary inline-flex mt-4">Go to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-title">Savings Groups</h1>
          <p className="section-sub">Digital chamas — save together, grow together</p>
        </div>
        {member.identity_level >= 3 && (
          <CreateChamaModal memberId={member.id} />
        )}
      </div>

      {/* My groups */}
      {chamas.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-ink-900 mb-3">My groups ({chamas.length})</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {chamas.map((c: any) => (
              <Link key={c.id} href={`/chama/${c.id}`}>
                <div className="card hover:border-earth-300 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-earth-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-earth-600" />
                      </div>
                      <div>
                        <p className="font-medium text-ink-900">{c.name}</p>
                        <span className={`badge text-xs ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-earth-400">Pool balance</p>
                      <p className="font-display text-lg text-ink-900">KES {c.balance.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-earth-500 pt-3 border-t border-earth-100">
                    <span>KES {c.contribution_amount} / cycle</span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      You contributed: KES {c.total_contributed.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Discover */}
      {openChamas && openChamas.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-ink-900 mb-3">Open groups to join</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {openChamas.map((c: any) => (
              <Link key={c.id} href={`/chama/${c.id}`}>
                <div className="card hover:border-earth-300 transition-colors cursor-pointer border-dashed">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Users className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-ink-900">{c.name}</p>
                      <p className="text-xs text-earth-500">KES {c.contribution_amount} / cycle</p>
                    </div>
                  </div>
                  <button className="btn-secondary w-full text-xs mt-2">
                    <Plus className="w-3.5 h-3.5 inline mr-1" />Request to join
                  </button>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {chamas.length === 0 && (!openChamas || openChamas.length === 0) && (
        <div className="card text-center py-16">
          <Users className="w-12 h-12 text-earth-300 mx-auto mb-3" />
          <h2 className="font-display text-xl text-ink-900 mb-2">No groups yet</h2>
          <p className="text-sm text-earth-500 mb-4">Reach Level 3 to create your own chama, or ask a Level 3 member to invite you.</p>
        </div>
      )}
    </div>
  )
}
