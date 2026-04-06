// app/api/marketplace/listings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUserWithMember } from '@/lib/supabase/server'
import { classifyListing, embed } from '@/lib/cohere'

const PROHIBITED_KEYWORDS = ['weapon', 'drug', 'alcohol', 'counterfeit', 'stolen', 'fake id', 'illegal']

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

  const supabase = await createClient()

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

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      seller_id: member.id,
      title,
      description,
      category,
      price,
      cloudinary_public_id: cloudinaryPublicId || null,
      status,
      quality_score: qualityScore,
      listing_embedding: embedding ? `[${embedding.join(',')}]` : null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    listing,
    message: status === 'pending'
      ? 'Listing submitted for review. It will go live once approved.'
      : 'Listing is now live on the marketplace.',
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const sellerId = searchParams.get('sellerId')

  let query = supabase
    .from('listings')
    .select('id, title, description, category, price, cloudinary_public_id, status, quality_score, created_at, seller_id, members!seller_id(display_name, identity_level)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50)

  if (category) query = query.eq('category', category)
  if (sellerId) query = query.eq('seller_id', sellerId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ listings: data || [] })
}
