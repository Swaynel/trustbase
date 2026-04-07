// proxy.ts
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PATHS = ['/dashboard', '/chama', '/marketplace', '/loans', '/governance', '/profile']
const OPERATOR_PATHS = ['/operator']

// Simple in-memory rate limiter (upgrade to Upstash Redis for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 60        // requests
const RATE_WINDOW_MS = 60000 // per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { response, user } = await updateSession(request)
  const isApiRoute = pathname.startsWith('/api')
  const isPublicApiRoute =
    pathname.startsWith('/api/auth/member-status') ||
    pathname.startsWith('/api/auth/profile') ||
    pathname.startsWith('/api/ussd') ||
    pathname.startsWith('/api/paystack/webhook')

  // API routes: enforce rate limit on authenticated users
  if (isApiRoute && user) {
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
  }

  // Redirect unauthenticated users away from protected routes
  if (!user) {
    const isProtected =
      PROTECTED_PATHS.some(p => pathname.startsWith(p)) ||
      OPERATOR_PATHS.some(p => pathname.startsWith(p))

    if (isApiRoute && !isPublicApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (isProtected) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
