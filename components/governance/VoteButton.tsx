'use client'
// components/governance/VoteButton.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'

export default function VoteButton({ voteId, weight }: { voteId: string; weight: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'yes' | 'no' | null>(null)

  async function castVote(choice: 'yes' | 'no') {
    setLoading(choice)
    try {
      const res = await fetch('/api/governance/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteId, choice }),
      })
      if (res.ok) router.refresh()
    } catch (e) { console.error(e) }
    setLoading(null)
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={() => castVote('yes')}
        disabled={!!loading}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-forest-400/10 hover:bg-forest-400/20 text-forest-600 text-sm font-medium transition-colors"
      >
        {loading === 'yes' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
        YES · {weight}×
      </button>
      <button
        onClick={() => castVote('no')}
        disabled={!!loading}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium transition-colors"
      >
        {loading === 'no' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
        NO · {weight}×
      </button>
    </div>
  )
}
