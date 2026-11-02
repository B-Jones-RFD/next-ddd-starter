import type { ISignInThrottle } from '@/modules/identity/application/ports/sign-in-throttle.port'
import type { Email } from '@/modules/identity/domain/user/email'

const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60_000

/** The failure times still inside the window at `now`. */
export function recentFailures(
  failures: readonly number[],
  now: Date
): number[] {
  return failures.filter((time) => now.getTime() - time < WINDOW_MS)
}

/** Whether these failure times block a sign-in at `now`. */
export function blocks(failures: readonly number[], now: Date): boolean {
  return recentFailures(failures, now).length >= MAX_FAILURES
}

/**
 * Failed sign-ins per email, in this process's memory. A local-only
 * simplification: a deployed app with several instances needs a shared
 * store behind the same port (§13).
 */
export class SignInThrottle implements ISignInThrottle {
  private readonly failures = new Map<string, number[]>()

  async isBlocked(email: Email, now: Date): Promise<boolean> {
    return blocks(this.failures.get(email) ?? [], now)
  }

  async recordFailure(email: Email, now: Date): Promise<void> {
    const recent = recentFailures(this.failures.get(email) ?? [], now)
    this.failures.set(email, [...recent, now.getTime()])
  }

  async clear(email: Email): Promise<void> {
    this.failures.delete(email)
  }
}
