import 'server-only'

import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'session'

/** 30 days, the session's absolute limit (ADR 0009). */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/** The raw session token this request presented, or `''`. */
export async function readSessionToken(): Promise<string> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? ''
}

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

/** Removes the session cookie. Only Server Actions may call it. */
export async function clearSessionCookie(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}
