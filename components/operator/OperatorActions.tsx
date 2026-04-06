'use client'
// components/operator/OperatorActions.tsx
import { useState, useEffect } from 'react'
import { UserPlus, TrendingUp, ArrowRightLeft, Loader2, CheckCircle2, Upload } from 'lucide-react'

interface QueuedTx {
  id: string
  type: string
  memberId: string
  amount?: number
  chamaId?: string
  timestamp: number
  synced: boolean
}

const QUEUE_KEY = 'tb_operator_queue'

export default function OperatorActions({ operatorId }: { operatorId: string }) {
  const [queue, setQueue] = useState<QueuedTx[]>([])
  const [activeTab, setActiveTab] = useState<'contribute' | 'onboard' | 'transfer'>('contribute')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ memberId: '', amount: '', chamaId: '', phone: '', name: '' })

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(QUEUE_KEY)
      if (stored) setQueue(JSON.parse(stored))
    } catch {}
  }, [])

  function saveQueue(q: QueuedTx[]) {
    setQueue(q)
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) } catch {}
  }

  function enqueue(tx: Omit<QueuedTx, 'id' | 'timestamp' | 'synced'>) {
    const newTx: QueuedTx = { ...tx, id: `q_${Date.now()}`, timestamp: Date.now(), synced: false }
    saveQueue([newTx, ...queue])
  }

  async function syncQueue() {
    const pending = queue.filter(t => !t.synced)
    if (!pending.length) return
    setLoading(true)

    const results = await Promise.allSettled(
      pending.map(tx =>
        fetch('/api/chama/contribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...tx, operatorId }),
        })
      )
    )

    const updatedQueue = queue.map((tx, i) => {
      const idx = pending.findIndex(p => p.id === tx.id)
      if (idx >= 0 && results[idx].status === 'fulfilled') {
        return { ...tx, synced: true }
      }
      return tx
    })

    saveQueue(updatedQueue)
    setLoading(false)
  }

  // Auto-sync when online
  useEffect(() => {
    function trySync() {
      if (navigator.onLine && queue.some(t => !t.synced)) syncQueue()
    }
    window.addEventListener('online', trySync)
    return () => window.removeEventListener('online', trySync)
  }, [queue])

  async function handleContribute() {
    if (!form.memberId || !form.amount || !form.chamaId) return
    if (navigator.onLine) {
      setLoading(true)
      try {
        await fetch('/api/chama/contribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: form.memberId,
            chamaId: form.chamaId,
            amount: Number(form.amount),
            operatorId,
          }),
        })
      } catch {}
      setLoading(false)
    } else {
      enqueue({ type: 'contribution', memberId: form.memberId, amount: Number(form.amount), chamaId: form.chamaId })
    }
    setForm(f => ({ ...f, memberId: '', amount: '' }))
  }

  const unsyncedCount = queue.filter(t => !t.synced).length

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['contribute', 'onboard', 'transfer'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors
              ${activeTab === tab ? 'bg-earth-500 text-white' : 'bg-earth-800 text-earth-400 hover:bg-earth-700'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Contribute */}
      {activeTab === 'contribute' && (
        <div className="space-y-3">
          <input className="w-full bg-earth-800 border border-earth-700 rounded-xl px-4 py-3 text-sm text-white placeholder-earth-500 focus:outline-none focus:border-earth-500"
            placeholder="Member ID" value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} />
          <input className="w-full bg-earth-800 border border-earth-700 rounded-xl px-4 py-3 text-sm text-white placeholder-earth-500 focus:outline-none focus:border-earth-500"
            placeholder="Chama ID" value={form.chamaId} onChange={e => setForm(f => ({ ...f, chamaId: e.target.value }))} />
          <input className="w-full bg-earth-800 border border-earth-700 rounded-xl px-4 py-3 text-sm text-white placeholder-earth-500 focus:outline-none focus:border-earth-500"
            type="number" placeholder="Amount (KES)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <button onClick={handleContribute} disabled={loading || !form.memberId || !form.amount}
            className="w-full py-3 rounded-xl bg-earth-500 hover:bg-earth-600 text-white text-sm font-medium flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {navigator.onLine ? 'Record contribution' : 'Queue contribution (offline)'}
          </button>
        </div>
      )}

      {/* Onboard */}
      {activeTab === 'onboard' && (
        <div className="space-y-3">
          <p className="text-xs text-earth-400">Register a new member on their behalf</p>
          <input className="w-full bg-earth-800 border border-earth-700 rounded-xl px-4 py-3 text-sm text-white placeholder-earth-500 focus:outline-none focus:border-earth-500"
            placeholder="Member name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className="w-full bg-earth-800 border border-earth-700 rounded-xl px-4 py-3 text-sm text-white placeholder-earth-500 focus:outline-none focus:border-earth-500"
            placeholder="Phone number" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <p className="text-xs text-earth-500">Member will receive SMS to complete registration</p>
          <button className="w-full py-3 rounded-xl bg-earth-500 hover:bg-earth-600 text-white text-sm font-medium flex items-center justify-center gap-2">
            <UserPlus className="w-4 h-4" /> Onboard member
          </button>
        </div>
      )}

      {/* Transfer */}
      {activeTab === 'transfer' && (
        <div className="space-y-3">
          <p className="text-xs text-earth-400">Facilitate a cross-city value transfer</p>
          <input className="w-full bg-earth-800 border border-earth-700 rounded-xl px-4 py-3 text-sm text-white placeholder-earth-500 focus:outline-none focus:border-earth-500"
            placeholder="Sender member ID" value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} />
          <input className="w-full bg-earth-800 border border-earth-700 rounded-xl px-4 py-3 text-sm text-white placeholder-earth-500 focus:outline-none focus:border-earth-500"
            type="number" placeholder="Amount (KES)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <button className="w-full py-3 rounded-xl bg-earth-500 hover:bg-earth-600 text-white text-sm font-medium flex items-center justify-center gap-2">
            <ArrowRightLeft className="w-4 h-4" /> Initiate transfer
          </button>
        </div>
      )}

      {/* Offline queue */}
      {queue.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-earth-400">
              Queued transactions ({unsyncedCount} pending)
            </p>
            {unsyncedCount > 0 && navigator.onLine && (
              <button onClick={syncQueue} disabled={loading}
                className="text-xs text-earth-400 hover:text-earth-300 flex items-center gap-1">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Sync now
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {queue.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center gap-2 text-xs text-earth-400">
                {tx.synced
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  : <div className="w-3.5 h-3.5 rounded-full border border-earth-500" />
                }
                <span>{tx.type}</span>
                <span>KES {tx.amount?.toLocaleString()}</span>
                <span className="ml-auto">{tx.synced ? 'synced' : 'pending'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
