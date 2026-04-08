// app/api/marketplace/disputes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveDispute, type DisputeResolution } from '@/lib/cohere'
import { getCurrentUserWithMember } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { user, member } = await getCurrentUserWithMember()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId, description } = await req.json()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      listing_id: true,
      buyer_id: true,
      seller_id: true,
      amount: true,
      status: true,
      paystack_reference: true,
    },
  })

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Only buyer or seller can raise dispute
  if (order.buyer_id !== member.id && order.seller_id !== member.id) {
    return NextResponse.json({ error: 'Not authorised to dispute this order' }, { status: 403 })
  }

  if (order.status === 'disputed') {
    return NextResponse.json({ error: 'Dispute already open' }, { status: 400 })
  }

  const [listing, buyer, seller] = await Promise.all([
    prisma.listing.findUnique({
      where: { id: order.listing_id },
      select: { title: true, description: true },
    }),
    prisma.member.findUnique({
      where: { id: order.buyer_id },
      select: { identity_level: true },
    }),
    prisma.member.findUnique({
      where: { id: order.seller_id },
      select: { identity_level: true },
    }),
  ])

  // Call Cohere for AI resolution recommendation
  let cohereResult: DisputeResolution | null = null
  try {
    cohereResult = await resolveDispute({
      orderDetails: `Listing: ${listing?.title || 'Unknown listing'}. Amount: KES ${order.amount.toNumber()}. Status: ${order.status}. Payment ref: ${order.paystack_reference || 'N/A'}`,
      buyerLevel: buyer?.identity_level || 0,
      sellerLevel: seller?.identity_level || 0,
      description,
    })
  } catch (e) {
    console.error('Cohere dispute resolution failed:', e)
  }

  // Update order status and create dispute record
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'disputed' },
  })

  const dispute = await prisma.dispute.create({
    data: {
      order_id: orderId,
      raised_by: member.id,
      description,
      cohere_summary: cohereResult?.summary || null,
      recommended_resolution: cohereResult?.recommendation || 'escalate',
      cohere_confidence: cohereResult?.confidence || null,
    },
  })

  return NextResponse.json({
    dispute: {
      ...dispute,
      cohere_confidence: dispute.cohere_confidence?.toNumber() ?? null,
      created_at: dispute.created_at.toISOString(),
    },
    aiRecommendation: cohereResult,
    message: 'Dispute raised. A moderator will review within 24 hours.',
  })
}
