import { describe, expect, it } from 'vitest'

import type { ISignInThrottle } from '@/modules/identity/application/ports/sign-in-throttle.port'
import type { Email } from '@/modules/identity/domain/user/email'

const ada = 'ada@example.com' as Email
const ben = 'ben@example.com' as Email
const start = new Date('2026-01-01T10:00:00.000Z')
const MINUTE = 60_000
const at = (ms: number) => new Date(start.getTime() + ms)

async function fail(throttle: ISignInThrottle, email: Email, times: number) {
  for (let i = 0; i < times; i += 1) {
    await throttle.recordFailure(email, at(i * MINUTE))
  }
}

/** What every `ISignInThrottle` adapter must do. */
export function describeSignInThrottleContract(make: () => ISignInThrottle) {
  describe('ISignInThrottle contract', () => {
    it('lets an email with fewer than 5 recent failures try', async () => {
      const throttle = make()
      await fail(throttle, ada, 4)

      expect(await throttle.isBlocked(ada, at(5 * MINUTE))).toBe(false)
    })

    it('blocks an email after 5 failures in 15 minutes, and no other', async () => {
      const throttle = make()
      await fail(throttle, ada, 5)

      expect(await throttle.isBlocked(ada, at(5 * MINUTE))).toBe(true)
      expect(await throttle.isBlocked(ben, at(5 * MINUTE))).toBe(false)
    })

    it('lets the email try again once failures are 15 minutes old', async () => {
      const throttle = make()
      await fail(throttle, ada, 5)

      // The first failure was at 0; at 15 minutes only 4 are recent.
      expect(await throttle.isBlocked(ada, at(15 * MINUTE - 1))).toBe(true)
      expect(await throttle.isBlocked(ada, at(15 * MINUTE))).toBe(false)
    })

    it('forgets an email’s failures when cleared', async () => {
      const throttle = make()
      await fail(throttle, ada, 5)

      await throttle.clear(ada)

      expect(await throttle.isBlocked(ada, at(5 * MINUTE))).toBe(false)
    })
  })
}
