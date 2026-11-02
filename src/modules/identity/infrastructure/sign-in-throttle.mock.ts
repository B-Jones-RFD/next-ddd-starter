import type { ISignInThrottle } from '@/modules/identity/application/ports/sign-in-throttle.port'
import type { Email } from '@/modules/identity/domain/user/email'
import {
  blocks,
  recentFailures,
} from '@/modules/identity/infrastructure/sign-in-throttle'
import { mockStore } from '@/shared/infrastructure/mock-stores'

/** Twin of `SignInThrottle`, with its failures in a resettable mock store. */
export class MockSignInThrottle implements ISignInThrottle {
  private failures(): Map<string, number[]> {
    return mockStore('identity.sign-in-failures', () => new Map())
  }

  async isBlocked(email: Email, now: Date): Promise<boolean> {
    return blocks(this.failures().get(email) ?? [], now)
  }

  async recordFailure(email: Email, now: Date): Promise<void> {
    const failures = this.failures()
    const recent = recentFailures(failures.get(email) ?? [], now)
    failures.set(email, [...recent, now.getTime()])
  }

  async clear(email: Email): Promise<void> {
    this.failures().delete(email)
  }
}
