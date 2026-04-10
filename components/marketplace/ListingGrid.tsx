'use client'
// components/marketplace/ListingGrid.tsx
import Image from 'next/image'
import { useState } from 'react'
import { ShoppingBag, ShoppingCart, Loader2 } from 'lucide-react'

interface Listing {
  id: string
  title: string
  description: string
  category: string
  price: number
  cloudinary_public_id?: string | null
  image_url?: string | null
  seller_id: string
  created_at: string
  members?: { display_name: string } | null
}

const CATEGORY_EMOJI: Record<string, string> = {
  food: '🌽', clothing: '👗', services: '🔧', electronics: '📱', crafts: '🧶', other: '📦',
}

async function readJsonSafely(res: Response) {
  const raw = await res.text()
  if (!raw) return null

  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

export default function ListingGrid({ listings, currentMemberId }: {
  listings: Listing[]; currentMemberId: string
}) {
  if (!listings.length) {
    return (
      <div className="card text-center py-16">
        <ShoppingBag className="w-12 h-12 text-earth-300 mx-auto mb-3" />
        <p className="text-sm text-earth-400">No listings found</p>
        <p className="text-xs text-earth-300 mt-1">Be the first to list something!</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {listings.map(l => (
        <ListingCard key={l.id} listing={l} isOwner={l.seller_id === currentMemberId} />
      ))}
    </div>
  )
}

function ListingCard({ listing: l, isOwner }: { listing: Listing; isOwner: boolean }) {
  const [ordering, setOrdering] = useState(false)

  async function handleBuy() {
    setOrdering(true)
    try {
      // First create order
      const orderRes = await fetch('/api/marketplace/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: l.id }),
      })
      const orderData = await readJsonSafely(orderRes)
      if (!orderRes.ok || !orderData || !('order' in orderData)) {
        alert(
          (orderData && typeof orderData.error === 'string' && orderData.error) ||
          'Could not create your marketplace order.'
        )
        return
      }

      // Then initiate charge
      const chargeRes = await fetch('/api/paystack/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'marketplace_order', amount: l.price, orderId: (orderData.order as { id: string }).id }),
      })
      const chargeData = await readJsonSafely(chargeRes)
      if (!chargeRes.ok || !chargeData) {
        alert(
          (chargeData && typeof chargeData.error === 'string' && chargeData.error) ||
          'Could not start payment right now.'
        )
        return
      }

      if (typeof chargeData.authorizationUrl === 'string') {
        window.location.href = chargeData.authorizationUrl
        return
      }

      alert('Payment link was not returned. Please try again.')
    } catch (e) {
      console.error(e)
      alert('Something went wrong while starting your purchase.')
    } finally {
      setOrdering(false)
    }
  }

  const imgUrl = l.image_url || null

  return (
    <div className="card p-0 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="aspect-[4/3] bg-earth-50 flex items-center justify-center relative">
        {imgUrl ? (
          <Image src={imgUrl} alt={l.title} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
        ) : (
          <span className="text-4xl">{CATEGORY_EMOJI[l.category] || '📦'}</span>
        )}
        <span className="absolute top-2 left-2 badge bg-earth-800 text-earth-300 text-xs shadow-sm">
          {l.category}
        </span>
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="font-medium text-ink-100 text-sm truncate mb-0.5">{l.title}</p>
        <p className="text-xs text-earth-400 line-clamp-2 mb-2">{l.description}</p>
        <div className="flex items-center justify-between">
          <p className="font-display text-base text-earth-600">KES {l.price.toLocaleString()}</p>
          <p className="text-xs text-earth-400">{l.members?.display_name || 'Seller'}</p>
        </div>

        {!isOwner && (
          <button
            onClick={handleBuy}
            disabled={ordering}
            className="btn-primary w-full mt-2 text-xs flex items-center justify-center gap-1.5 py-2"
          >
            {ordering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
            Buy
          </button>
        )}
        {isOwner && (
          <div className="mt-2 text-center">
            <span className="badge bg-earth-100 text-earth-600 text-xs">Your listing</span>
          </div>
        )}
      </div>
    </div>
  )
}
