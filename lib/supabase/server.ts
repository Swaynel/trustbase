// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { Member } from '@prisma/client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import {
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from '@/lib/supabase/env'

function serializeMember(member: Member) {
  return {
    ...member,
    display_name: member.display_name ?? '',
    cloudinary_profile_id: member.cloudinary_profile_id ?? undefined,
    internal_balance: member.internal_balance.toNumber(),
    reputation_score: member.reputation_score.toNumber(),
    created_at: member.created_at.toISOString(),
    updated_at: member.updated_at.toISOString(),
    credit_narrative_at: member.credit_narrative_at?.toISOString() ?? null,
  }
}

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options)
          } catch {}
        },
        remove(name: string) {
          try {
            cookieStore.delete(name)
          } catch {}
        },
      },
    }
  )
}

export async function getCurrentUserWithMember() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { user: null, member: null, userError, memberError: null }
  }

  const member = await prisma.member.findUnique({
    where: { auth_id: user.id },
  })

  return {
    user,
    member: member ? serializeMember(member) : null,
    userError: null,
    memberError: null,
  }
}

export function createServiceClient() {
  return createSupabaseClient(
    getSupabaseUrl(),
    getSupabaseSecretKey(),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }
  )
}
