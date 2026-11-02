import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  authenticate,
  InvalidCredentialsError,
  signIn,
  signUp,
  TooManyAttemptsError,
  ValidationError,
} from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { UnauthenticatedError } from '@/shared/kernel/errors/app-error'

import { aSignUp } from '@tests/fixtures/identity'

const credentials = { email: 'ada@example.com', password: 'correct horse' }

beforeEach(async () => {
  resetMockStores()
  await signUp(aSignUp({ ...credentials, displayName: 'Ada' }))
})

afterEach(() => {
  vi.useRealTimers()
})

async function tokenOf(result: Awaited<ReturnType<typeof signIn>>) {
  if (!result.ok) throw new Error(`sign-in failed: ${result.error.code}`)
  return result.value.token
}

describe('signIn', () => {
  it('starts a session for the user, ignoring case and spaces in the email', async () => {
    const token = await tokenOf(
      await signIn({ email: ' ADA@example.com ', password: 'correct horse' })
    )

    expect(await authenticate(token)).toEqual({
      ok: true,
      value: { userId: expect.any(String), displayName: 'Ada' },
    })
  })

  it('gives a wrong password and an unknown email the same error', async () => {
    const wrongPassword = await signIn({ ...credentials, password: 'nope' })
    const unknownEmail = await signIn({
      email: 'nobody@example.com',
      password: 'correct horse',
    })

    expect(wrongPassword).toEqual({
      ok: false,
      error: new InvalidCredentialsError(),
    })
    expect(unknownEmail).toEqual(wrongPassword)
  })

  it('checks an unknown email against a dummy hash, so its timing matches', async () => {
    const verify = vi.spyOn(await getInjection('IPasswordHasher'), 'verify')

    await signIn({ email: 'nobody@example.com', password: 'correct horse' })

    expect(verify).toHaveBeenCalledOnce()
  })

  it('returns ValidationError for a missing email or password', async () => {
    const result = await signIn({ email: ' ', password: '' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBeInstanceOf(ValidationError)
    expect((result.error as ValidationError).fields).toEqual({
      email: 'required',
      password: 'required',
    })
  })

  it('returns TooManyAttemptsError after 5 failures in 15 minutes, even with the right password', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'))
    for (let i = 0; i < 5; i += 1) {
      await signIn({ ...credentials, password: 'wrong password' })
    }

    expect(await signIn(credentials)).toEqual({
      ok: false,
      error: new TooManyAttemptsError(),
    })

    vi.setSystemTime(new Date('2026-01-01T10:15:00.000Z'))
    expect((await signIn(credentials)).ok).toBe(true)
  })

  it('forgets earlier failures after a successful sign-in', async () => {
    for (let i = 0; i < 4; i += 1) {
      await signIn({ ...credentials, password: 'wrong password' })
    }
    await signIn(credentials)

    await signIn({ ...credentials, password: 'wrong password' })

    expect((await signIn(credentials)).ok).toBe(true)
  })

  it('ends the older session this browser presented', async () => {
    const older = await tokenOf(await signIn(credentials))

    const newer = await tokenOf(
      await signIn({ ...credentials, currentToken: older })
    )

    expect(await authenticate(older)).toEqual({
      ok: false,
      error: new UnauthenticatedError(),
    })
    expect((await authenticate(newer)).ok).toBe(true)
  })

  it('keeps sessions on other browsers', async () => {
    const elsewhere = await tokenOf(await signIn(credentials))

    await signIn(credentials)

    expect((await authenticate(elsewhere)).ok).toBe(true)
  })

  it('upgrades a hash made with older parameters, and the password still works', async () => {
    const hasher = await getInjection('IPasswordHasher')
    vi.spyOn(hasher, 'needsRehash').mockReturnValueOnce(true)
    const hash = vi.spyOn(hasher, 'hash')

    await tokenOf(await signIn(credentials))

    expect(hash).toHaveBeenCalledOnce()
    expect((await signIn(credentials)).ok).toBe(true)
  })
})
