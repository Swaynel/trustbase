'use client'
// components/identity/OriginCorroborate.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Loader2, CheckCircle2, Users } from 'lucide-react'

export default function OriginCorroborate({
  memberId, originCountry, currentScore,
}: { memberId: string; originCountry: string; currentScore: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [memberId2, setMemberId2] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const progressPct = Math.min(Math.round(currentScore), 100)

  async function handleCorroborate() {
    if (!memberId2.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/identity/corroborations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: memberId2.trim(), originCountry }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not record corroboration')
        setLoading(false)
        return
      }
      setDone(true)
      router.refresh()
    } catch {
      setError('Failed to record corroboration.')
    }
    setLoading(false)
  }

  function copyId() {
    navigator.clipboard.writeText(memberId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="card rounded-[28px] p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-earth-100 flex items-center justify-center">
          <Globe className="w-5 h-5 text-earth-600" />
        </div>
        <div>
          <h3 className="font-display text-xl text-ink-100">Origin Web</h3>
          <p className="text-xs font-medium text-earth-400 uppercase tracking-widest">Pillar 1: Corroboration</p>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink-200 uppercase tracking-tight">
            <Users className="w-3.5 h-3.5" /> Progress
          </div>
          <span className="text-2xl font-display text-earth-600 leading-none">{progressPct}%</span>
        </div>
        <div className="h-3 w-full bg-earth-100 rounded-full overflow-hidden border border-earth-50">
          <div
            className="h-full bg-earth-500 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-earth-500 mt-3 leading-relaxed">
          You need <span className="font-bold text-ink-100 underline decoration-earth-300">3 Level 2+ members</span> from {originCountry} to corroborate your origin.
          Share your ID below with them so they can submit it from their own profile.
        </p>
      </div>

      <div className="space-y-6">
        {done && (
          <div className="rounded-2xl bg-forest-50 border border-forest-200 px-4 py-3 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-forest-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-forest-700">Corroboration recorded</p>
              <p className="text-xs text-forest-500 mt-0.5">Thank you for strengthening the community trust network.</p>
            </div>
          </div>
        )}

        <div className="surface-subtle p-5 rounded-2xl">
          <label className="block text-[11px] font-bold text-earth-500 uppercase tracking-widest mb-3">Corroborate Another Member</label>
          <p className="text-xs text-earth-500 mb-3 leading-relaxed">
            Enter the ID of another member from {originCountry} only if they asked you to vouch for their origin.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="input flex-1"
              placeholder="Enter another member's ID..."
              value={memberId2}
              onChange={e => setMemberId2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCorroborate()}
            />
            <button
              onClick={handleCorroborate}
              disabled={!memberId2.trim() || loading}
              className="btn-primary px-6 py-3 text-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
            </button>
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 mt-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-earth-100 rounded-2xl transform rotate-1 transition-transform group-hover:rotate-0" />
          <div className="relative surface-subtle p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-earth-400 uppercase">Share This ID With Corroborators</p>
              <p className="text-sm font-mono font-medium text-ink-100">{memberId}</p>
              <p className="text-xs text-earth-500 mt-1">
                Members from {originCountry} can enter this ID on their profile to support your Origin Web pillar.
              </p>
            </div>
            <button
              onClick={copyId}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${copied ? 'bg-forest-500 text-white' : 'surface-chip text-earth-300 hover:bg-earth-100'}`}
            >
              {copied ? 'Copied!' : 'Copy ID'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
