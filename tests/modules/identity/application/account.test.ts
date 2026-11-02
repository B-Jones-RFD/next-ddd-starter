import { beforeEach, describe, expect, it } from 'vitest'

import { getInjection } from '@/di/container'
import {
  authenticate,
  changePassword,
  ForbiddenError,
  IncorrectPasswordError,
  InvalidCredentialsError,
  rename,
  signIn,
  signUp,
  ValidationError,
} from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { UnauthenticatedError } from '@/shared/kernel/errors/app-error'
import { toUserId } from '@/shared/kernel/user-id'

import { aSignUp } from '@tests/fixtures/identity'

const credentials = { email: 'ada@example.com', password: 'correct horse' }

beforeEach(() => {
  resetMockStores()
})

async function signedUp(displayName = 'Ada') {
  const result = await signUp(aSignUp({ ...credentials, displayName }))
  if (!result.ok) throw new Error('sign-up failed')
  const actor = await authenticate(result.value.token)
  if (!actor.ok) throw new Error('authenticate failed')
  return { token: result.value.token, actorId: actor.value.userId }
}

describe('changePassword', () => {
  it('replaces the password, keeping this session and ending the others', async () => {
    const { token, actorId } = await signedUp()
    const elsewhere = await signIn(credentials)
    if (!elsewhere.ok) throw new Error('sign-in failed')

    const result = await changePassword({
      actorId,
      token,
      currentPassword: 'correct horse',
      newPassword: 'battery staple',
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect((await authenticate(token)).ok).toBe(true)
    expect(await authenticate(elsewhere.value.token)).toEqual({
      ok: false,
      error: new UnauthenticatedError(),
    })
    expect(await signIn(credentials)).toEqual({
      ok: false,
      error: new InvalidCredentialsError(),
    })
    expect(
      (await signIn({ ...credentials, password: 'battery staple' })).ok
    ).toBe(true)
  })

  it('returns IncorrectPasswordError for a wrong current password, changing nothing', async () => {
    const { token, actorId } = await signedUp()

    const result = await changePassword({
      actorId,
      token,
      currentPassword: 'wrong password',
      newPassword: 'battery staple',
    })

    expect(result).toEqual({ ok: false, error: new IncorrectPasswordError() })
    expect((await signIn(credentials)).ok).toBe(true)
  })

  it('returns ValidationError naming the new password’s field', async () => {
    const { token, actorId } = await signedUp()

    const result = await changePassword({
      actorId,
      token,
      currentPassword: '',
      newPassword: 'short',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBeInstanceOf(ValidationError)
    expect((result.error as ValidationError).fields).toEqual({
      currentPassword: 'required',
      newPassword: 'too-short',
    })
  })

  it('returns UnauthenticatedError for a session that isn’t the actor’s', async () => {
    const { actorId } = await signedUp()
    const other = await signUp(aSignUp())
    if (!other.ok) throw new Error('sign-up failed')

    const result = await changePassword({
      actorId,
      token: other.value.token,
      currentPassword: 'correct horse',
      newPassword: 'battery staple',
    })

    expect(result).toEqual({ ok: false, error: new UnauthenticatedError() })
  })
})

describe('rename', () => {
  it('changes the display name the session shows', async () => {
    const { token, actorId } = await signedUp('Ada')

    expect(await rename({ actorId, displayName: ' Ada Lovelace ' })).toEqual({
      ok: true,
      value: undefined,
    })

    expect(await authenticate(token)).toEqual({
      ok: true,
      value: { userId: actorId, displayName: 'Ada Lovelace' },
    })
  })

  it('returns ValidationError for an invalid name', async () => {
    const { actorId } = await signedUp()

    const result = await rename({ actorId, displayName: 'x'.repeat(51) })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect((result.error as ValidationError).fields).toEqual({
      displayName: 'too-long',
    })
  })

  it('returns ForbiddenError for an actor that isn’t a user', async () => {
    const result = await rename({
      actorId: toUserId('nobody'),
      displayName: 'Eve',
    })

    expect(result).toEqual({ ok: false, error: new ForbiddenError() })
  })

  it('shows the new name on boards once the relay drains', async () => {
    const { actorId } = await signedUp('Ada')
    const relay = await getInjection('IEventRelay')
    await relay.drain()

    await rename({ actorId, displayName: 'Ada Lovelace' })
    await relay.drain()

    const people = await getInjection('IPeopleProjection')
    expect(await people.find(actorId)).toEqual({
      ok: true,
      value: { userId: actorId, displayName: 'Ada Lovelace' },
    })
  })
})
