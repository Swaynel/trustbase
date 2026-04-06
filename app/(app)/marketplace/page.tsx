// app/(app)/marketplace/page.tsx
import { getCurrentUserWithMember } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShoppingBag, Plus, Lock } from 'lucide-react'
import SearchBar from '@/components/marketplace/SearchBar'
import ListingGrid from '@/components/marketplace/ListingGrid'
import CreateListingModal from '@/components/marketplace/CreateListingModal'

const CATEGORIES = ['all', 'food', 'clothing', 'services', 'electronics', 'crafts', 'other']

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string }
}) {
  const { supabase, user, member } = await getCurrentUserWithMember()
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
          <h2 className="font-display text-xl text-ink-900 mb-2">Level 2 required</h2>
          <p className="text-sm text-earth-500">Complete 2 identity pillars to access the marketplace.</p>
        </div>
      </div>
    )
  }

  // Fetch listings — if search query, use semantic search endpoint
  let listings: any[] = []
  const query = searchParams.q?.trim()
  const category = searchParams.category && searchParams.category !== 'all' ? searchParams.category : null

  if (query) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/marketplace/search?q=${encodeURIComponent(query)}`,
        { cache: 'no-store' }
      )
      const data = await res.json()
      listings = data.listings || []
    } catch {
      // fallback to regular query
    }
  }

  if (!query) {
    let dbQuery = supabase
      .from('listings')
      .select('id, title, description, category, price, cloudinary_public_id, seller_id, created_at, members!seller_id(display_name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(30)

    if (category) dbQuery = dbQuery.eq('category', category)

    const { data } = await dbQuery
    listings = data || []
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-title">Marketplace</h1>
          <p className="section-sub">Buy and sell within your community</p>
        </div>
        <CreateListingModal memberId={member.id} />
      </div>

      {/* Search */}
      <SearchBar defaultValue={searchParams.q} />

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
          {listings.length} result{listings.length !== 1 ? 's' : ''} for "{query}"
          {listings.length > 0 && <span className="ml-1 text-earth-400">(AI semantic search)</span>}
        </p>
      )}

      <ListingGrid listings={listings} currentMemberId={member.id} />
    </div>
  )
}
