// proxy.ts
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PATHS = ['/dashboard', '/chama', '/marketplace', '/loans', '/governance', '/profile']
const OPERATOR_PATHS = ['/operator']
const AUTH_PATHS = ['/login']

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
  const memberId = response.headers.get('x-user-id')

  // API routes: enforce rate limit on authenticated users
  if (pathname.startsWith('/api') && user) {
    const userId = memberId || user.id
    if (!checkRateLimit(userId)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
  }

  // Redirect unauthenticated users away from protected routes
  if (!user) {
    const isProtected =
      PROTECTED_PATHS.some(p => pathname.startsWith(p)) ||
      OPERATOR_PATHS.some(p => pathname.startsWith(p)) ||
      (pathname.startsWith('/api') &&
        !pathname.startsWith('/api/ussd') &&
        !pathname.startsWith('/api/paystack/webhook'))
    if (isProtected) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Redirect authenticated users away from auth pages
  if (user && memberId && AUTH_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Operator route guard
  if (OPERATOR_PATHS.some(p => pathname.startsWith(p))) {
    const role = response.headers.get('x-user-role')
    if (role !== 'operator' && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
