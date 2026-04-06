'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

type AcceptAgentButtonProps = {
  transferId: string
  agentId: string
}

export default function AcceptAgentButton({
  transferId,
  agentId,
}: AcceptAgentButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAccept() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/transfer/request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferId,
          agentId,
          action: 'accept',
        }),
      })

      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error || 'Could not accept transfer.')
        return
      }

      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-w-[11rem] flex-col items-end gap-2">
      <button
        className="btn-primary flex items-center gap-2 px-4 py-2"
        disabled={loading}
        onClick={handleAccept}
        type="button"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {loading ? 'Accepting...' : 'Accept request'}
      </button>
      {error ? <p className="max-w-[14rem] text-right text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
