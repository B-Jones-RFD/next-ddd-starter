import { beforeEach, describe, expect, it } from 'vitest'

import {
  authenticate,
  findUserByEmail,
  NotFoundError,
  signUp,
  ValidationError,
} from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

import { aSignUp } from '@tests/fixtures/identity'

beforeEach(() => {
  resetMockStores()
})

async function signedUp(displayName: string, email: string) {
  const result = await signUp(aSignUp({ displayName, email }))
  if (!result.ok) throw new Error('sign-up failed')
  const actor = await authenticate(result.value.token)
  if (!actor.ok) throw new Error('authenticate failed')
  return actor.value.userId
}

describe('findUserByEmail', () => {
  it('finds a registered user by email, ignoring case and spaces', async () => {
    const ada = await signedUp('Ada', 'ada@example.com')
    const ben = await signedUp('Ben', 'ben@example.com')

    expect(
      await findUserByEmail({ actorId: ada, email: '  BEN@example.com ' })
    ).toEqual({
      ok: true,
      value: { userId: ben, displayName: 'Ben', email: 'ben@example.com' },
    })
  })

  it('returns NotFoundError for an email nobody registered', async () => {
    const ada = await signedUp('Ada', 'ada@example.com')

    const result = await findUserByEmail({
      actorId: ada,
      email: 'nobody@example.com',
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBeInstanceOf(NotFoundError)
  })

  it('returns ValidationError for an address that isn’t an email', async () => {
    const ada = await signedUp('Ada', 'ada@example.com')

    const result = await findUserByEmail({ actorId: ada, email: 'ben' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBeInstanceOf(ValidationError)
    expect((result.error as ValidationError).fields).toEqual({
      email: 'invalid',
    })
  })
})
