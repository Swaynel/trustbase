'use client'
// components/loans/GuaranteeAction.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function GuaranteeAction({ guaranteeId, loanId }: { guaranteeId: string; loanId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)

  async function respond(accepted: boolean) {
    setLoading(accepted ? 'accept' : 'decline')
    try {
      await fetch('/api/loans/guarantee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId, accepted }),
      })
      router.refresh()
    } catch (e) { console.error(e) }
    setLoading(null)
  }

  return (
    <div className="flex gap-3">
      <button onClick={() => respond(false)} disabled={!!loading}
        className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm border border-earth-200">
        {loading === 'decline' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
        Decline
      </button>
      <button onClick={() => respond(true)} disabled={!!loading}
        className="btn-primary flex-1 flex items-center justify-center gap-2">
        {loading === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Guarantee
      </button>
    </div>
  )
}
