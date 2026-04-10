// app/(app)/marketplace/[id]/page.tsx
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import BuyButton from '@/components/marketplace/BuyButton'
import DisputeButton from '@/components/marketplace/DisputeButton'
import { getListingUrl } from '@/lib/cloudinary'

const CATEGORY_EMOJI: Record<string, string> = {
  food: '🌽', clothing: '👗', services: '🔧', electronics: '📱', crafts: '🧶', other: '📦',
}

type ListingDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params
  const { user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')
  if (!member) redirect('/login')

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      seller_id: true,
      title: true,
      description: true,
      category: true,
      price: true,
      cloudinary_public_id: true,
      status: true,
      created_at: true,
    },
  })

  if (!listing) notFound()

  const seller = await prisma.member.findUnique({
    where: { id: listing.seller_id },
    select: {
      id: true,
      display_name: true,
      identity_level: true,
      reputation_score: true,
    },
  })
  const isOwner = seller?.id === member.id

  const existingOrder = await prisma.order.findFirst({
    where: {
      listing_id: listing.id,
      buyer_id: member.id,
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      status: true,
    },
  })

  const imgUrl = listing.cloudinary_public_id ? getListingUrl(listing.cloudinary_public_id) : null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-earth-500 hover:text-earth-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to marketplace
      </Link>

      <div className="card p-0 overflow-hidden">
        {/* Image */}
        <div className="aspect-video bg-earth-50 flex items-center justify-center relative">
          {imgUrl
            ? <Image src={imgUrl} alt={listing.title} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
            : <span className="text-6xl">{CATEGORY_EMOJI[listing.category || 'other'] || '📦'}</span>
          }
          <span className="absolute top-3 left-3 badge bg-earth-800 text-earth-300 shadow-sm">
            {listing.category || 'other'}
          </span>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="font-display text-2xl text-ink-100 mb-1">{listing.title}</h1>
              <p className="text-earth-400 leading-relaxed">{listing.description}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-display text-3xl text-earth-600">KES {decimalToNumber(listing.price).toLocaleString()}</p>
            </div>
          </div>

          {/* Seller info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-earth-50 mb-5">
            <div className="w-10 h-10 rounded-full bg-earth-300 flex items-center justify-center text-white font-bold">
              {(seller?.display_name || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-100">{seller?.display_name || 'Seller'}</p>
              <div className="flex items-center gap-2 text-xs text-earth-400">
                <span>Level {seller?.identity_level || 0}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3" /> Rep {Math.round(decimalToNumber(seller?.reputation_score))}/100
                </span>
              </div>
            </div>
          </div>

          {/* Action */}
          {isOwner ? (
            <div className="p-3 rounded-xl bg-earth-50 text-center">
              <p className="text-sm text-earth-500">This is your listing</p>
            </div>
          ) : existingOrder ? (
            <div className="space-y-3">
              <div className={`p-3 rounded-xl text-center text-sm font-medium
                ${existingOrder.status === 'paid' || existingOrder.status === 'completed'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                Order status: {existingOrder.status}
              </div>
              {existingOrder.status === 'paid' && (
                <DisputeButton orderId={existingOrder.id} />
              )}
            </div>
          ) : listing.status === 'active' ? (
            <BuyButton listing={{ id: listing.id, price: decimalToNumber(listing.price), title: listing.title }} />
          ) : (
            <div className="surface-subtle p-3 text-center text-sm text-earth-400">
              This listing is no longer available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
