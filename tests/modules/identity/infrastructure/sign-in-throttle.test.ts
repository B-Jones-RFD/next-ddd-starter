import { describe } from 'vitest'

import { SignInThrottle } from '@/modules/identity/infrastructure/sign-in-throttle'
import { MockSignInThrottle } from '@/modules/identity/infrastructure/sign-in-throttle.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

import { describeSignInThrottleContract } from '@tests/contracts/sign-in-throttle.contract'

describe('SignInThrottle (in memory)', () => {
  describeSignInThrottleContract(() => new SignInThrottle())
})

describe('MockSignInThrottle', () => {
  describeSignInThrottleContract(() => {
    resetMockStores()
    return new MockSignInThrottle()
  })
})
