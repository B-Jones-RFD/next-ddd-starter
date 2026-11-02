import { beforeEach, describe, expect, it } from 'vitest'

import { getInjection } from '@/di/container'
import { authenticate, signUp } from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

import { aSignUp } from '@tests/fixtures/identity'

beforeEach(() => {
  resetMockStores()
})

async function signedUp(displayName: string) {
  const result = await signUp(aSignUp({ displayName }))
  if (!result.ok) throw new Error('sign-up failed')
  const actor = await authenticate(result.value.token)
  if (!actor.ok) throw new Error('authenticate failed')
  return actor.value.userId
}

describe('boards learns display names from identity.UserRegistered.v1', () => {
  it('knows a new user’s display name after the relay drains', async () => {
    const userId = await signedUp('Ada Lovelace')

    await (await getInjection('IEventRelay')).drain()

    const people = await getInjection('IPeopleProjection')
    expect(await people.find(userId)).toEqual({
      ok: true,
      value: { userId, displayName: 'Ada Lovelace' },
    })
  })

  it('doesn’t know them before the relay drains', async () => {
    const userId = await signedUp('Ada Lovelace')

    const people = await getInjection('IPeopleProjection')
    expect((await people.find(userId)).ok).toBe(false)
  })
})
