// app/api/marketplace/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { embedQuery } from '@/lib/cohere'
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from '@/lib/prisma-utils'

type DecimalValue = Parameters<typeof decimalToNumber>[0]

type FallbackListingRow = {
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
  identity_level: number
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  }

  try {
    // Embed the query
    const queryEmbedding = await embedQuery(q)
    const vector = `[${queryEmbedding.join(',')}]`

    const rows = await prisma.$queryRaw<Array<{
      id: string
      title: string
      description: string
      category: string | null
      price: unknown
      cloudinary_public_id: string | null
      seller_id: string
      created_at: Date
      similarity: number
    }>>`
      SELECT
        l.id,
        l.title,
        l.description,
        l.category,
        l.price,
        l.cloudinary_public_id,
        l.seller_id,
        l.created_at,
        1 - (l.listing_embedding <=> ${vector}::vector) AS similarity
      FROM public.listings l
      WHERE
        l.status = 'active'
        AND l.listing_embedding IS NOT NULL
        AND 1 - (l.listing_embedding <=> ${vector}::vector) > ${0.3}
      ORDER BY l.listing_embedding <=> ${vector}::vector
      LIMIT ${20}
    `

    if (!rows.length) {
      const fallbackRows: FallbackListingRow[] = await prisma.listing.findMany({
        where: {
          status: 'active',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 20,
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

      const fallbackSellerIds = Array.from(new Set(fallbackRows.map((listing: FallbackListingRow) => listing.seller_id)))
      const fallbackSellers: SellerRow[] = fallbackSellerIds.length
        ? await prisma.member.findMany({
            where: { id: { in: fallbackSellerIds } },
            select: { id: true, display_name: true, identity_level: true },
          })
        : []
      const fallbackSellerMap = new Map<string, SellerRow>(
        fallbackSellers.map((seller: SellerRow) => [seller.id, seller])
      )

      return NextResponse.json({
        listings: fallbackRows.map((listing: FallbackListingRow) => ({
          ...listing,
          price: decimalToNumber(listing.price),
          created_at: listing.created_at.toISOString(),
          members: fallbackSellerMap.get(listing.seller_id)
            ? {
                display_name: fallbackSellerMap.get(listing.seller_id)?.display_name || 'Seller',
                identity_level: fallbackSellerMap.get(listing.seller_id)?.identity_level || 0,
              }
            : null,
        })),
        method: 'text',
      })
    }

    const sellerIds = Array.from(new Set(rows.map((row) => row.seller_id)))
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
      listings: rows.map((row) => ({
        ...row,
        price: decimalToNumber(row.price as number | string),
        created_at: row.created_at.toISOString(),
        members: sellerMap.get(row.seller_id)
          ? {
              display_name: sellerMap.get(row.seller_id)?.display_name || 'Seller',
              identity_level: sellerMap.get(row.seller_id)?.identity_level || 0,
            }
          : null,
      })),
      method: 'semantic',
    })
  } catch (e) {
    console.error('Search error:', e)
    return NextResponse.json({ listings: [], error: 'Search unavailable' }, { status: 500 })
  }
}
