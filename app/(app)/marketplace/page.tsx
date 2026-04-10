// app/(app)/marketplace/page.tsx
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Lock } from 'lucide-react'
import SearchBar from '@/components/marketplace/SearchBar'
import ListingGrid from '@/components/marketplace/ListingGrid'
import CreateListingModal from '@/components/marketplace/CreateListingModal'
import { getListingUrl } from '@/lib/cloudinary'

const CATEGORIES = ['all', 'food', 'clothing', 'services', 'electronics', 'crafts', 'other']

type DecimalValue = Parameters<typeof decimalToNumber>[0]

type MarketplacePageProps = {
  searchParams: Promise<{ q?: string; category?: string }>
}

type ListingRow = {
  id: string
  title: string
  description: string
  category: string | null
  price: DecimalValue
  cloudinary_public_id: string | null
  seller_id: string
  created_at: Date
}

type SellerRow = {
  id: string
  display_name: string | null
}

type MarketplaceListing = {
  id: string
  title: string
  description: string
  category: string
  price: number
  cloudinary_public_id: string | null
  image_url?: string | null
  seller_id: string
  created_at: string
  members: { display_name: string; identity_level?: number } | null
}

type SearchResponse = {
  listings?: MarketplaceListing[]
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const resolvedSearchParams = await searchParams
  const { user, member } = await getCurrentUserWithMember()
  if (!user) redirect('/login')

  if (!member) redirect('/login')

  if (member.identity_level < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="section-title">Marketplace</h1>
          <p className="section-sub">Buy and sell within your community</p>
        </div>
        <div className="card text-center py-16">
          <Lock className="w-12 h-12 text-earth-300 mx-auto mb-3" />
          <h2 className="font-display text-xl text-ink-100 mb-2">Level 2 required</h2>
          <p className="text-sm text-earth-500">Complete 2 identity pillars to access the marketplace.</p>
        </div>
      </div>
    )
  }

  // Fetch listings — if search query, use semantic search endpoint
  let listings: MarketplaceListing[] = []
  const query = resolvedSearchParams.q?.trim()
  const category = resolvedSearchParams.category && resolvedSearchParams.category !== 'all'
    ? resolvedSearchParams.category
    : null

  if (query) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/marketplace/search?q=${encodeURIComponent(query)}`,
        { cache: 'no-store' }
      )
      const data = await res.json() as SearchResponse
      listings = data.listings || []
    } catch {
      // fallback to regular query
    }
  }

  if (!query) {
    const listingRows: ListingRow[] = await prisma.listing.findMany({
      where: {
        status: 'active',
        ...(category ? { category } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        price: true,
        cloudinary_public_id: true,
        seller_id: true,
        created_at: true,
      },
    })

    const sellerIds = Array.from(new Set(listingRows.map((listing: ListingRow) => listing.seller_id)))
    const sellers: SellerRow[] = sellerIds.length
      ? await prisma.member.findMany({
          where: { id: { in: sellerIds } },
          select: { id: true, display_name: true },
        })
      : []
    const sellerMap = new Map<string, string>(
      sellers.map((seller: SellerRow) => [seller.id, seller.display_name || 'Seller'])
    )

    listings = listingRows.map((listing: ListingRow) => ({
      ...listing,
      category: listing.category || 'other',
      price: decimalToNumber(listing.price),
      image_url: listing.cloudinary_public_id ? getListingUrl(listing.cloudinary_public_id) : null,
      created_at: listing.created_at.toISOString(),
      members: { display_name: sellerMap.get(listing.seller_id) || 'Seller' },
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-title">Marketplace</h1>
          <p className="section-sub">Buy and sell within your community</p>
        </div>
        <CreateListingModal />
      </div>

      {/* Search */}
      <SearchBar defaultValue={resolvedSearchParams.q} />

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORIES.map(cat => (
          <a
            key={cat}
            href={`/marketplace?${cat !== 'all' ? `category=${cat}` : ''}${query ? `&q=${query}` : ''}`}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-colors
              ${(category === cat || (!category && cat === 'all'))
                ? 'bg-earth-500 text-white'
                : 'bg-earth-100 text-earth-700 hover:bg-earth-200'
              }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </a>
        ))}
      </div>

      {/* Results */}
      {query && (
        <p className="text-sm text-earth-500">
          {listings.length} result{listings.length !== 1 ? 's' : ''} for &quot;{query}&quot;
          {listings.length > 0 && <span className="ml-1 text-earth-400">(AI semantic search)</span>}
        </p>
      )}

      <ListingGrid listings={listings} currentMemberId={member.id} />
    </div>
  )
}
