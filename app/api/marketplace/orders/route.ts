// app/api/marketplace/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listingId } = await req.json()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      seller_id: true,
      price: true,
      title: true,
      status: true,
    },
  })

  if (!listing || listing.status !== 'active') {
    return NextResponse.json({ error: 'Listing not available' }, { status: 404 })
  }

  if (listing.seller_id === member.id) {
    return NextResponse.json({ error: 'Cannot buy your own listing' }, { status: 400 })
  }

  const order = await prisma.order.create({
    data: {
      listing_id: listingId,
      buyer_id: member.id,
      seller_id: listing.seller_id,
      amount: listing.price,
      status: 'pending',
    },
  })

  return NextResponse.json({
    order: {
      ...order,
      amount: order.amount.toNumber(),
      created_at: order.created_at.toISOString(),
    },
    amount: listing.price.toNumber(),
  })
}

export async function GET(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') || 'buyer'

  const orders = await prisma.order.findMany({
    where: role === 'seller' ? { seller_id: member.id } : { buyer_id: member.id },
    orderBy: { created_at: 'desc' },
  })

  const listingIds = [...new Set(orders.map((order) => order.listing_id))]
  const listings = listingIds.length > 0
    ? await prisma.listing.findMany({
        where: { id: { in: listingIds } },
        select: { id: true, title: true, cloudinary_public_id: true },
      })
    : []

  const listingsById = new Map(listings.map((listing) => [listing.id, listing]))

  return NextResponse.json({
    orders: orders.map((order) => ({
      ...order,
      amount: order.amount.toNumber(),
      created_at: order.created_at.toISOString(),
      listings: listingsById.get(order.listing_id) || null,
    })),
  })
}
