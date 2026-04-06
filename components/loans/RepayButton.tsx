'use client'
// components/loans/RepayButton.tsx
import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

export default function RepayButton({ loanId, amount }: { loanId: string; amount: number }) {
  const [loading, setLoading] = useState(false)

  async function handleRepay() {
    setLoading(true)
    try {
      const res = await fetch('/api/paystack/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'loan_repayment', amount, loanId }),
      })
      const data = await res.json()
      if (data.authorizationUrl) window.location.href = data.authorizationUrl
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  return (
    <button onClick={handleRepay} disabled={loading}
      className="btn-primary w-full flex items-center justify-center gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
      Repay KES {amount.toLocaleString()}
    </button>
  )
}
