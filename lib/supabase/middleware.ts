// lib/supabase/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env'

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set(name, value)
          supabaseResponse.cookies.set(name, value, options)
        },
        remove(name: string) {
          request.cookies.delete(name)
          supabaseResponse.cookies.delete(name)
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  return { response: supabaseResponse, user }
}
