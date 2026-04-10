'use client'
// components/governance/CreateProposalModal.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Vote, Loader2 } from 'lucide-react'

export default function CreateProposalModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ proposal: '', windowDays: '3' })

  async function handleCreate() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/governance/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal: form.proposal,
          windowDays: Number(form.windowDays),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }
      setOpen(false)
      setForm({ proposal: '', windowDays: '3' })
      router.refresh()
    } catch {
      setError('Failed to submit proposal.')
    }
    setLoading(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
        <Plus className="w-4 h-4" /> New proposal
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
          <div className="surface-modal w-full max-w-md fade-in">
            <div className="flex items-center justify-between p-6 border-b border-earth-100">
              <div className="flex items-center gap-2">
                <Vote className="w-5 h-5 text-earth-500" />
                <h2 className="font-display text-xl text-ink-100">New proposal</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-earth-50 rounded-lg">
                <X className="w-4 h-4 text-earth-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="field-label">Proposal text</label>
                <textarea
                  className="input resize-none h-28"
                  placeholder="e.g. Increase maximum chama size from 30 to 50 members"
                  value={form.proposal}
                  onChange={e => setForm(f => ({ ...f, proposal: e.target.value }))}
                />
              </div>
              <div>
                <label className="field-label">Voting window</label>
                <select className="input" value={form.windowDays}
                  onChange={e => setForm(f => ({ ...f, windowDays: e.target.value }))}>
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                </select>
              </div>

              {error && <p className="text-red-600 text-xs">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={!form.proposal.trim() || loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Submit proposal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
