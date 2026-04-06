'use client'
// components/chama/ContributeButton.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Loader2 } from 'lucide-react'

declare global { interface Window { PaystackPop: any } }

export default function ContributeButton({ chamaId, amount }: { chamaId: string; amount: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleContribute() {
    setLoading(true)
    try {
      const res = await fetch('/api/paystack/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'contribution', amount, chamaId }),
      })
      const data = await res.json()

      if (data.authorizationUrl) {
        // Redirect to Paystack hosted page (works for mobile money)
        window.location.href = data.authorizationUrl
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleContribute}
      disabled={loading}
      className="btn-primary flex items-center gap-2 flex-1 justify-center"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
      Contribute KES {amount.toLocaleString()}
    </button>
  )
}
