// app/api/marketplace/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embedQuery } from '@/lib/cohere'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  }

  try {
    // Embed the query
    const queryEmbedding = await embedQuery(q)
    const vectorStr = `[${queryEmbedding.join(',')}]`

    // pgvector cosine similarity search
    const { data, error } = await supabase.rpc('search_listings', {
      query_embedding: vectorStr,
      match_threshold: 0.3,
      match_count: 20,
    })

    if (error) {
      // Fallback to text search if vector search fails
      const { data: fallback } = await supabase
        .from('listings')
        .select('id, title, description, category, price, cloudinary_public_id, seller_id, members!seller_id(display_name, identity_level)')
        .eq('status', 'active')
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(20)

      return NextResponse.json({ listings: fallback || [], method: 'text' })
    }

    return NextResponse.json({ listings: data || [], method: 'semantic' })
  } catch (e) {
    console.error('Search error:', e)
    return NextResponse.json({ listings: [], error: 'Search unavailable' }, { status: 500 })
  }
}
