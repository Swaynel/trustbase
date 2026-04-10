// app/api/marketplace/listings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { classifyListing, embed } from '@/lib/cohere'
import { getListingUrl } from '@/lib/cloudinary'
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

const PROHIBITED_KEYWORDS = ['weapon', 'drug', 'alcohol', 'counterfeit', 'stolen', 'fake id', 'illegal']

type DecimalValue = Parameters<typeof decimalToNumber>[0]

type ListingRow = {
  id: string
  title: string
  description: string
  category: string | null
  price: DecimalValue
  cloudinary_public_id: string | null
  status: string
  quality_score: DecimalValue
  created_at: Date
  seller_id: string
}

type SellerRow = {
  id: string
  display_name: string | null
  identity_level: number
}

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, price, cloudinaryPublicId } = body

  if (!title || !description || !price) {
    return NextResponse.json({ error: 'title, description and price are required' }, { status: 400 })
  }

  if (!member || member.identity_level < 2) {
    return NextResponse.json({ error: 'Level 2 required to sell on marketplace' }, { status: 403 })
  }

  // Quick keyword check for prohibited content
  const combinedText = `${title} ${description}`.toLowerCase()
  const isProhibited = PROHIBITED_KEYWORDS.some(kw => combinedText.includes(kw))

  // Classify listing category + quality
  let category = 'other'
  let qualityScore = 3
  let status: 'active' | 'pending' = 'active'

  try {
    const classification = await classifyListing(title, description)
    category = classification.prediction
    qualityScore = Math.round(classification.confidence * 5)
    if (qualityScore < 2 || isProhibited) status = 'pending'
  } catch (e) {
    console.error('Cohere classify failed:', e)
  }

  // Generate semantic embedding
  let embedding: number[] | null = null
  try {
    const embeddings = await embed([`${title}. ${description}`])
    embedding = embeddings[0]
  } catch (e) {
    console.error('Cohere embed failed:', e)
  }

  try {
    const listing = await prisma.listing.create({
      data: {
        seller_id: member.id,
        title,
        description,
        category,
        price,
        cloudinary_public_id: cloudinaryPublicId || null,
        status,
        quality_score: qualityScore,
      },
      select: {
        id: true,
        seller_id: true,
        title: true,
        description: true,
        category: true,
        price: true,
        cloudinary_public_id: true,
        status: true,
        quality_score: true,
        created_at: true,
      },
    })

    if (embedding?.length) {
      const vector = `[${embedding.join(',')}]`
      await prisma.$executeRaw`
        UPDATE public.listings
        SET listing_embedding = ${vector}::vector
        WHERE id = ${listing.id}::uuid
      `
    }

    return NextResponse.json({
      listing: {
        ...listing,
        price: decimalToNumber(listing.price),
        image_url: listing.cloudinary_public_id ? getListingUrl(listing.cloudinary_public_id) : null,
        quality_score: listing.quality_score == null ? null : decimalToNumber(listing.quality_score),
        created_at: listing.created_at.toISOString(),
      },
      message: status === 'pending'
        ? 'Listing submitted for review. It will go live once approved.'
        : 'Listing is now live on the marketplace.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create listing'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const sellerId = searchParams.get('sellerId')

  const listings: ListingRow[] = await prisma.listing.findMany({
    where: {
      status: 'active',
      ...(category ? { category } : {}),
      ...(sellerId ? { seller_id: sellerId } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      price: true,
      cloudinary_public_id: true,
      status: true,
      quality_score: true,
      created_at: true,
      seller_id: true,
    },
  })

  const sellerIds = Array.from(new Set(listings.map((listing: ListingRow) => listing.seller_id)))
  const sellers: SellerRow[] = sellerIds.length
    ? await prisma.member.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, display_name: true, identity_level: true },
      })
    : []
  const sellerMap = new Map<string, SellerRow>(
    sellers.map((seller: SellerRow) => [seller.id, seller])
  )

  return NextResponse.json({
    listings: listings.map((listing: ListingRow) => ({
      ...listing,
      price: decimalToNumber(listing.price),
      image_url: listing.cloudinary_public_id ? getListingUrl(listing.cloudinary_public_id) : null,
      quality_score: listing.quality_score == null ? null : decimalToNumber(listing.quality_score),
      created_at: listing.created_at.toISOString(),
      members: sellerMap.get(listing.seller_id)
        ? {
            display_name: sellerMap.get(listing.seller_id)?.display_name || 'Seller',
            identity_level: sellerMap.get(listing.seller_id)?.identity_level || 0,
          }
        : null,
    })),
  })
}
