import { NextResponse, type NextRequest } from 'next/server'

import { signInPath } from '@/app/_lib/auth/next-path'

// The optimistic check (§9): a protected route without a session cookie goes
// straight to sign-in. Whether the cookie's session is valid is decided by
// `getActor()` in each page and action, never here. `/sign-in` is never
// matched, so a stale cookie can't loop.

export function proxy(request: NextRequest) {
  if (request.cookies.has('session')) return NextResponse.next()
  const { pathname, search } = request.nextUrl
  return NextResponse.redirect(
    new URL(signInPath(`${pathname}${search}`), request.url)
  )
}

export const config = {
  matcher: ['/boards', '/boards/:path*', '/account'],
}
