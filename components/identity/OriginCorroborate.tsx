'use client'
// components/identity/OriginCorroborate.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Loader2, CheckCircle2 } from 'lucide-react'

export default function OriginCorroborate({
  memberId, originCountry, currentScore,
}: { memberId: string; originCountry: string; currentScore: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [memberId2, setMemberId2] = useState('')
  const [error, setError] = useState('')

  async function handleCorroborate() {
    if (!memberId2.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/identity/corroborations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: memberId2.trim(),
          originCountry,
        }),
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

  return (
    <div className="card border-earth-200 bg-earth-50">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-5 h-5 text-earth-500" />
        <h3 className="font-medium text-ink-900">Origin Web — Pillar 1</h3>
      </div>
      <p className="text-xs text-earth-600 mb-4">
        Pillar 1 activates when 3+ Level 2 community members who share your origin corroborate your declared country.
        Current: <strong>{Math.round(currentScore)}%</strong>
      </p>

      {done ? (
        <p className="text-sm text-forest-600 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Corroboration recorded. Thank you.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium text-earth-600">Corroborate another member from {originCountry}</p>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Paste member ID to corroborate"
              value={memberId2}
              onChange={e => setMemberId2(e.target.value)}
            />
            <button
              onClick={handleCorroborate}
              disabled={!memberId2.trim() || loading}
              className="btn-primary flex items-center gap-2 flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Corroborate
            </button>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <p className="text-xs text-earth-400">Your Member ID: <span className="font-mono">{memberId}</span></p>
        </div>
      )}
    </div>
  )
}
