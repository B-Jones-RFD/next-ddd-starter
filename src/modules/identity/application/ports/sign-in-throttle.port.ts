import type { Email } from '@/modules/identity/domain/user/email'

/**
 * Slows down password guessing: an email with 5 failed sign-ins in the last
 * 15 minutes is blocked (ADR 0009). Throws `InfrastructureError` on an
 * outage.
 */
export interface ISignInThrottle {
  /** Whether sign-in for `email` is blocked at `now`. */
  isBlocked(email: Email, now: Date): Promise<boolean>
  recordFailure(email: Email, now: Date): Promise<void>
  /** Forgets the email's failures, after a successful sign-in. */
  clear(email: Email): Promise<void>
}
