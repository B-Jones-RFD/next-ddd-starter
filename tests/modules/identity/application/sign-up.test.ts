import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  authenticate,
  EmailTakenError,
  signUp,
  ValidationError,
} from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'

import { aSignUp } from '@tests/fixtures/identity'

beforeEach(() => {
  resetMockStores()
})

describe('signUp', () => {
  it('registers the user and signs them in', async () => {
    const result = await signUp(
      aSignUp({ displayName: '  Ada Lovelace ', email: 'ada@example.com' })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const actor = await authenticate(result.value.token)
    expect(actor).toEqual({
      ok: true,
      value: { userId: expect.any(String), displayName: 'Ada Lovelace' },
    })
  })

  it('gives each sign-up its own session', async () => {
    const first = await signUp(aSignUp())
    const second = await signUp(aSignUp())

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.value.token).not.toBe(second.value.token)
  })

  it('returns EmailTakenError for an email already registered, ignoring case and spaces', async () => {
    await signUp(aSignUp({ email: 'ada@example.com' }))

    const result = await signUp(aSignUp({ email: '  ADA@Example.com ' }))

    expect(result).toEqual({ ok: false, error: new EmailTakenError() })
  })

  it('returns ValidationError naming every invalid field', async () => {
    const result = await signUp({
      displayName: '',
      email: 'not-an-email',
      password: 'short',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBeInstanceOf(ValidationError)
    expect((result.error as ValidationError).fields).toEqual({
      displayName: 'required',
      email: 'invalid',
      password: 'too-short',
    })
  })

  it('returns ValidationError for input of the wrong shape', async () => {
    const result = await signUp({
      displayName: 'Ada',
      email: 42,
    } as unknown as Parameters<typeof signUp>[0])

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect((result.error as ValidationError).fields).toEqual({
      email: 'invalid',
      password: 'required',
    })
  })

  it('lets an outage propagate', async () => {
    const outage = new PersistenceError('IUserRepository', { retryable: true })
    vi.spyOn(
      await getInjection('IUserRepository'),
      'save'
    ).mockRejectedValueOnce(outage)

    await expect(signUp(aSignUp())).rejects.toBe(outage)
  })
})
