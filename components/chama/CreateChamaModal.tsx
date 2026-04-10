'use client'
// components/chama/CreateChamaModal.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus, Users, Loader2 } from 'lucide-react'

export default function CreateChamaModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    contribution_amount: '',
    cycle_days: '30',
  })

  async function handleCreate() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/chama/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          contributionAmount: Number(form.contribution_amount),
          cycleDays: Number(form.cycle_days),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not create group')
        setLoading(false)
        return
      }

      setOpen(false)
      setForm({
        name: '',
        description: '',
        contribution_amount: '',
        cycle_days: '30',
      })
      router.refresh()
    } catch {
      setError('Could not create group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
        <Plus className="w-4 h-4" /> New Group
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
          <div className="surface-modal w-full max-w-md fade-in">
            <div className="flex items-center justify-between p-6 border-b border-earth-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-earth-500" />
                <h2 className="font-display text-xl text-ink-100">Create savings group</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-earth-50 rounded-lg">
                <X className="w-4 h-4 text-earth-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="field-label">Group name</label>
                <input className="input" placeholder="e.g. Nairobi Women's Circle" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Description</label>
                <textarea className="input resize-none h-20" placeholder="What is this group for?"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Contribution (KES)</label>
                  <input className="input" type="number" placeholder="500" min="10"
                    value={form.contribution_amount}
                    onChange={e => setForm(f => ({ ...f, contribution_amount: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Cycle (days)</label>
                  <select className="input" value={form.cycle_days}
                    onChange={e => setForm(f => ({ ...f, cycle_days: e.target.value }))}>
                    <option value="7">Weekly (7)</option>
                    <option value="14">Bi-weekly (14)</option>
                    <option value="30">Monthly (30)</option>
                  </select>
                </div>
              </div>

              {error && <p className="text-red-600 text-xs">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name || !form.contribution_amount || loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
