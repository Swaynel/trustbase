'use client'
// components/loans/RequestLoanButton.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Landmark, X, Loader2 } from 'lucide-react'

interface Member { id: string; display_name: string; identity_level: number }

export default function RequestLoanButton({
  chamaId, memberList, currentMemberId,
}: { chamaId: string; memberList: Member[]; currentMemberId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ amount: '', purpose: '', guarantorIds: [] as string[] })

  const eligibleGuarantors = memberList.filter(m => m.id !== currentMemberId && m.identity_level >= 2)

  function toggleGuarantor(id: string) {
    setForm(f => ({
      ...f,
      guarantorIds: f.guarantorIds.includes(id)
        ? f.guarantorIds.filter(g => g !== id)
        : [...f.guarantorIds, id],
    }))
  }

  async function handleRequest() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/loans/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chamaId,
          amount: Number(form.amount),
          purpose: form.purpose,
          guarantorIds: form.guarantorIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Request failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary flex items-center gap-2 flex-1 justify-center">
        <Landmark className="w-4 h-4" /> Request loan
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
          <div className="surface-modal w-full max-w-md fade-in overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-earth-100">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-earth-500" />
                <h2 className="font-display text-xl text-ink-100">Request a loan</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-earth-50 rounded-lg">
                <X className="w-4 h-4 text-earth-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="field-label">Amount (KES)</label>
                <input className="input" type="number" placeholder="1000" min="100"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Purpose</label>
                <textarea className="input resize-none h-20" placeholder="What will you use this for?"
                  value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
              </div>

              <div>
                <label className="field-label">Select guarantors (min 2)</label>
                {eligibleGuarantors.length === 0 ? (
                  <p className="text-xs text-earth-400">No eligible guarantors in this group (need Level 2+).</p>
                ) : (
                  <div className="space-y-2">
                    {eligibleGuarantors.map(m => (
                      <label key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                        ${form.guarantorIds.includes(m.id) ? 'border-primary-500 bg-earth-50' : 'border-earth-100 bg-earth-800 hover:bg-earth-50'}`}>
                        <input
                          type="checkbox"
                          checked={form.guarantorIds.includes(m.id)}
                          onChange={() => toggleGuarantor(m.id)}
                          className="accent-earth-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-ink-100">{m.display_name}</p>
                          <p className="text-xs text-earth-400">Level {m.identity_level}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="text-red-600 text-xs">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button
                  onClick={handleRequest}
                  disabled={!form.amount || form.guarantorIds.length < 2 || loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Submit request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
