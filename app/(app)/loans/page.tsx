// app/(app)/loans/page.tsx
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Landmark, Clock, CheckCircle2, AlertCircle, Lock } from 'lucide-react'
import RepayButton from '@/components/loans/RepayButton'
import GuaranteeAction from '@/components/loans/GuaranteeAction'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  requested:    { label: 'Pending',    color: 'bg-amber-100 text-amber-700',  icon: <Clock className="w-3.5 h-3.5" /> },
  guaranteeing: { label: 'Awaiting guarantors', color: 'bg-blue-100 text-blue-700', icon: <Clock className="w-3.5 h-3.5" /> },
  approved:     { label: 'Approved',   color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  disbursed:    { label: 'Disbursed',  color: 'bg-forest-400/10 text-forest-600', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  repaid:       { label: 'Repaid',     color: 'bg-gray-100 text-gray-500',    icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  defaulted:    { label: 'Defaulted',  color: 'bg-red-100 text-red-700',      icon: <AlertCircle className="w-3.5 h-3.5" /> },
}

export default async function LoansPage() {
  const { supabase, user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!member) redirect('/login')

  if (member.identity_level < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="section-title">Loans</h1>
          <p className="section-sub">Peer-guarantee micro-loans from community savings</p>
        </div>
        <div className="card text-center py-16">
          <Lock className="w-12 h-12 text-earth-300 mx-auto mb-3" />
          <h2 className="font-display text-xl text-ink-900 mb-2">Level 2 required</h2>
          <p className="text-sm text-earth-500">Complete 2 identity pillars to access loans.</p>
        </div>
      </div>
    )
  }

  // My loans (as borrower)
  const { data: myLoans } = await supabase
    .from('loans')
    .select('*, chamas(name)')
    .eq('borrower_id', member.id)
    .order('created_at', { ascending: false })

  // Pending guarantee requests (as guarantor)
  const { data: pendingGuarantees } = await supabase
    .from('guarantees')
    .select('*, loans(id, amount, purpose, status, borrower_id, members!borrower_id(display_name))')
    .eq('guarantor_id', member.id)
    .is('accepted', null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Loans</h1>
        <p className="section-sub">Peer-guarantee micro-loans from community savings</p>
      </div>

      {/* How it works */}
      <div className="card bg-earth-50 border-earth-200">
        <h3 className="font-medium text-ink-900 text-sm mb-3">How peer-guarantee loans work</h3>
        <div className="grid md:grid-cols-3 gap-3 text-xs text-earth-600">
          <div className="flex gap-2"><span className="font-mono text-earth-400">01</span> Request a loan from your chama pool — nominate 2–3 guarantors</div>
          <div className="flex gap-2"><span className="font-mono text-earth-400">02</span> Guarantors stake their reputation score. On acceptance, funds are disbursed</div>
          <div className="flex gap-2"><span className="font-mono text-earth-400">03</span> Repay on time → guarantors earn reputation. Default → reputation deducted</div>
        </div>
      </div>

      {/* Pending guarantee actions */}
      {pendingGuarantees && pendingGuarantees.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-ink-900 mb-3">
            Guarantee requests ({pendingGuarantees.length})
          </h2>
          <div className="space-y-3">
            {pendingGuarantees.map((g: any) => (
              <div key={g.id} className="card border-amber-200 bg-amber-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-ink-900">
                      {g.loans?.members?.display_name || 'Member'} needs a guarantee
                    </p>
                    <p className="text-sm text-earth-600 mt-0.5">
                      KES {g.loans?.amount?.toLocaleString()} — {g.loans?.purpose || 'No purpose given'}
                    </p>
                  </div>
                  <span className="text-xs text-earth-500">Stake: {g.stake_score} rep pts</span>
                </div>
                <GuaranteeAction guaranteeId={g.id} loanId={g.loans?.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My loans */}
      <section>
        <h2 className="font-display text-lg text-ink-900 mb-3">My loans</h2>
        {!myLoans?.length ? (
          <div className="card text-center py-10">
            <Landmark className="w-10 h-10 text-earth-300 mx-auto mb-2" />
            <p className="text-sm text-earth-400">No loans yet</p>
            <p className="text-xs text-earth-300 mt-1">Request a loan from your savings group page</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myLoans.map((loan: any) => {
              const s = STATUS_CONFIG[loan.status] || STATUS_CONFIG.requested
              const daysLeft = loan.due_at
                ? Math.ceil((new Date(loan.due_at).getTime() - Date.now()) / 86400000)
                : null
              return (
                <div key={loan.id} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Landmark className="w-4 h-4 text-earth-500" />
                        <p className="font-medium text-ink-900">KES {loan.amount.toLocaleString()}</p>
                        <span className={`badge ${s.color} flex items-center gap-1`}>
                          {s.icon}{s.label}
                        </span>
                      </div>
                      {loan.purpose && <p className="text-sm text-earth-600">{loan.purpose}</p>}
                      {loan.chamas?.name && <p className="text-xs text-earth-400 mt-0.5">From: {loan.chamas.name}</p>}
                    </div>
                    {daysLeft !== null && loan.status === 'disbursed' && (
                      <div className={`text-right text-xs ${daysLeft < 3 ? 'text-red-500' : 'text-earth-400'}`}>
                        <p>{daysLeft > 0 ? `${daysLeft}d left` : 'OVERDUE'}</p>
                        <p>Due {new Date(loan.due_at).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                  {loan.status === 'disbursed' && (
                    <RepayButton loanId={loan.id} amount={loan.amount} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Reputation */}
      <div className="card bg-ink-900 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-earth-200 mb-1">Your reputation score</p>
            <p className="font-display text-3xl">{Math.round(member.reputation_score)}<span className="text-base text-earth-300">/100</span></p>
          </div>
          <div className="text-right text-xs text-earth-300">
            <p>Higher score = easier to get guarantors</p>
            <p>Repay on time to grow your score</p>
          </div>
        </div>
      </div>
    </div>
  )
}
