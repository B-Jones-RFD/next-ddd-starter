import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authenticate,
  signIn,
  signOut,
  signOutEverywhere,
  signUp,
} from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { UnauthenticatedError } from '@/shared/kernel/errors/app-error'

import { aSignUp } from '@tests/fixtures/identity'

const credentials = { email: 'ada@example.com', password: 'correct horse' }
const unauthenticated = { ok: false, error: new UnauthenticatedError() }

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const start = new Date('2026-01-01T10:00:00.000Z')
const at = (ms: number) => new Date(start.getTime() + ms)

beforeEach(() => {
  resetMockStores()
})

afterEach(() => {
  vi.useRealTimers()
})

async function signedUp() {
  const result = await signUp(aSignUp(credentials))
  if (!result.ok) throw new Error('sign-up failed')
  return result.value.token
}

async function signedIn() {
  const result = await signIn(credentials)
  if (!result.ok) throw new Error('sign-in failed')
  return result.value.token
}

describe('authenticate', () => {
  it.each(['', 'token-that-was-never-issued'])(
    'returns UnauthenticatedError for %j',
    async (token) => {
      expect(await authenticate(token)).toEqual(unauthenticated)
    }
  )

  // #region expiry
  describe('expiry', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(start)
    })

    it('ends a session after 7 days without use', async () => {
      const token = await signedUp()

      vi.setSystemTime(at(7 * DAY - MINUTE))
      expect((await authenticate(token)).ok).toBe(true)

      vi.setSystemTime(at(14 * DAY - 2 * MINUTE))
      expect((await authenticate(token)).ok).toBe(true)

      vi.setSystemTime(at(21 * DAY))
      expect(await authenticate(token)).toEqual(unauthenticated)
    })

    it('ends a session 30 days after it started, however much it is used', async () => {
      const token = await signedUp()
      for (let day = 5; day < 30; day += 5) {
        vi.setSystemTime(at(day * DAY))
        expect((await authenticate(token)).ok).toBe(true)
      }

      vi.setSystemTime(at(30 * DAY - MINUTE))
      expect((await authenticate(token)).ok).toBe(true)

      vi.setSystemTime(at(30 * DAY))
      expect(await authenticate(token)).toEqual(unauthenticated)
    })
  })
  // #endregion expiry
})

describe('signOut', () => {
  it('ends this session only', async () => {
    const here = await signedUp()
    const elsewhere = await signedIn()

    expect(await signOut(here)).toEqual({ ok: true, value: undefined })

    expect(await authenticate(here)).toEqual(unauthenticated)
    expect((await authenticate(elsewhere)).ok).toBe(true)
  })

  it('succeeds for a session that already ended, or never existed', async () => {
    const token = await signedUp()
    await signOut(token)

    expect(await signOut(token)).toEqual({ ok: true, value: undefined })
    expect(await signOut('never-issued')).toEqual({
      ok: true,
      value: undefined,
    })
  })
})

describe('signOutEverywhere', () => {
  it('ends every session of the user', async () => {
    const here = await signedUp()
    const elsewhere = await signedIn()
    const other = await signUp(aSignUp())
    if (!other.ok) throw new Error('sign-up failed')

    expect(await signOutEverywhere(here)).toEqual({
      ok: true,
      value: undefined,
    })

    expect(await authenticate(here)).toEqual(unauthenticated)
    expect(await authenticate(elsewhere)).toEqual(unauthenticated)
    expect((await authenticate(other.value.token)).ok).toBe(true)
  })

  it('returns UnauthenticatedError without a valid session', async () => {
    const token = await signedUp()
    await signOut(token)

    expect(await signOutEverywhere(token)).toEqual(unauthenticated)
  })
})
