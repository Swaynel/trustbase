'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, Loader2, CheckCircle2 } from 'lucide-react'

export default function CorroborateButton({
  subjectId,
  subjectName,
  originCountry,
}: {
  subjectId: string
  subjectName: string
  originCountry: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleCorroborate() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/identity/corroborations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
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
      setError('Something went wrong. Please try again.')
    }

    setLoading(false)
  }

  if (done) {
    return (
      <div className="inline-flex items-center gap-2 text-sm font-medium text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        Corroboration recorded. Thank you.
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleCorroborate}
        disabled={loading}
        className="btn-primary flex items-center gap-2 text-sm"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserCheck className="h-4 w-4" />
        )}
        Vouch for {subjectName}
      </button>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}
