'use client'
// components/marketplace/BuyButton.tsx
import { useState } from 'react'
import { ShoppingCart, Loader2 } from 'lucide-react'

export default function BuyButton({ listing }: {
  listing: { id: string; price: number; title: string }
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleBuy() {
    setLoading(true); setError('')
    try {
      // Create order
      const orderRes = await fetch('/api/marketplace/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id }),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok) { setError(orderData.error || 'Failed to create order'); setLoading(false); return }

      // Initiate Paystack charge
      const chargeRes = await fetch('/api/paystack/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'marketplace_order',
          amount: listing.price,
          orderId: orderData.order.id,
        }),
      })
      const chargeData = await chargeRes.json()
      if (chargeData.authorizationUrl) {
        window.location.href = chargeData.authorizationUrl
      } else {
        setError('Payment initiation failed.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
        Buy for KES {listing.price.toLocaleString()}
      </button>
      {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
    </div>
  )
}
