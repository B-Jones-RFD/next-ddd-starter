import 'server-only'

import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'session'

/** 30 days, the session's absolute limit (ADR 0009). */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/**
 * Sets the session cookie. Only Server Actions may call it. No `__Host-`
 * prefix, because Safari rejects `Secure` cookies on http://localhost (§13).
 */
export async function setSessionCookie(token: string): Promise<void> {
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
  })
}
