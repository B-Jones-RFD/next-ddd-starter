import { describe, expect, it } from 'vitest'

import { parseDisplayName } from '@/modules/identity/domain/user/display-name'
import { parseEmail } from '@/modules/identity/domain/user/email'
import { parsePassword } from '@/modules/identity/domain/user/password'
import {
  parsePasswordHash,
  type PasswordHash,
} from '@/modules/identity/domain/user/password-hash'
import {
  changeUserPassword,
  parseRegistration,
  registerUser,
  rehashUserPassword,
  renameUser,
} from '@/modules/identity/domain/user/user'
import {
  ForbiddenError,
  type ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { toUserId } from '@/shared/kernel/user-id'

import { aRegistration } from '@tests/fixtures/identity'

const issues = (result: { ok: boolean; error?: unknown }) =>
  result.ok ? undefined : (result.error as ValidationError).fields

describe('parseDisplayName', () => {
  it('trims', () => {
    expect(parseDisplayName('  Ada Lovelace ')).toEqual({
      ok: true,
      value: 'Ada Lovelace',
    })
  })

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['x'.repeat(51), 'too-long'],
  ])('rejects %j as %s', (raw, issue) => {
    expect(issues(parseDisplayName(raw))).toEqual({ displayName: issue })
  })

  it('accepts 50 characters', () => {
    expect(parseDisplayName('x'.repeat(50)).ok).toBe(true)
  })
})

describe('parseEmail', () => {
  it('trims and lowercases, so the same address can only register once', () => {
    expect(parseEmail('  Ada@Example.COM ')).toEqual({
      ok: true,
      value: 'ada@example.com',
    })
  })

  it.each([
    ['', 'required'],
    ['ada', 'invalid'],
    ['ada@example', 'invalid'],
    ['ada @example.com', 'invalid'],
    [`${'a'.repeat(250)}@x.io`, 'too-long'],
  ])('rejects %j as %s', (raw, issue) => {
    expect(issues(parseEmail(raw))).toEqual({ email: issue })
  })
})

describe('parsePassword', () => {
  it('keeps the password exactly as typed', () => {
    expect(parsePassword(' secret pass ')).toEqual({
      ok: true,
      value: ' secret pass ',
    })
  })

  it.each([
    ['', 'required'],
    ['1234567', 'too-short'],
    ['x'.repeat(129), 'too-long'],
  ])('rejects %j as %s', (raw, issue) => {
    expect(issues(parsePassword(raw))).toEqual({ password: issue })
  })
})

describe('parsePasswordHash', () => {
  it('accepts an algorithm-prefixed hash', () => {
    expect(parsePasswordHash('scrypt$131072$8$1$c2FsdA$aGFzaA').ok).toBe(true)
  })

  it('rejects anything else', () => {
    expect(issues(parsePasswordHash('password'))).toEqual({
      passwordHash: 'invalid',
    })
  })
})

describe('parseRegistration', () => {
  it('reports every invalid field at once', () => {
    const result = parseRegistration({
      displayName: ' ',
      email: 'nope',
      password: 'short',
    })

    expect(issues(result)).toEqual({
      displayName: 'required',
      email: 'invalid',
      password: 'too-short',
    })
  })

  it('returns the parsed values', () => {
    expect(
      parseRegistration({
        displayName: ' Ada ',
        email: 'ADA@example.com',
        password: 'password',
      })
    ).toEqual({
      ok: true,
      value: {
        displayName: 'Ada',
        email: 'ada@example.com',
        password: 'password',
      },
    })
  })
})

describe('registerUser', () => {
  it('creates a new user at version 0 and raises UserRegistered', () => {
    const now = new Date('2026-01-01T10:00:00.000Z')
    const registration = aRegistration({ displayName: 'Ada' })

    const { state, events } = registerUser({
      id: toUserId('user-1'),
      ...registration,
      now,
    })

    expect(state).toEqual({
      id: 'user-1',
      displayName: 'Ada',
      email: registration.email,
      passwordHash: registration.passwordHash,
      createdAt: now,
      version: 0,
    })
    expect(events).toEqual([
      {
        type: 'UserRegistered',
        payload: { userId: 'user-1', displayName: 'Ada' },
      },
    ])
  })
})

function aSavedUser() {
  return {
    ...registerUser({
      id: toUserId('user-1'),
      ...aRegistration({ displayName: 'Ada' }),
      now: new Date('2026-01-01T10:00:00.000Z'),
    }).state,
    version: 1,
  }
}

describe('renameUser', () => {
  it('changes the display name and raises UserRenamed with from and to', () => {
    const user = aSavedUser()

    const result = renameUser(user, user.id, ' Ada Lovelace ')

    expect(result).toEqual({
      ok: true,
      value: {
        state: { ...user, displayName: 'Ada Lovelace' },
        events: [
          {
            type: 'UserRenamed',
            payload: { userId: 'user-1', from: 'Ada', to: 'Ada Lovelace' },
          },
        ],
      },
    })
  })

  it('raises nothing when the name doesn’t change', () => {
    const user = aSavedUser()

    expect(renameUser(user, user.id, 'Ada')).toEqual({
      ok: true,
      value: { state: user, events: [] },
    })
  })

  it('returns ValidationError for an invalid name', () => {
    const user = aSavedUser()

    expect(issues(renameUser(user, user.id, ' '))).toEqual({
      displayName: 'required',
    })
  })

  it('returns ForbiddenError for anyone but the user', () => {
    const result = renameUser(aSavedUser(), toUserId('user-2'), 'Eve')

    expect(result).toEqual({ ok: false, error: new ForbiddenError() })
  })
})

describe('changeUserPassword', () => {
  it('stores the new hash and raises UserPasswordChanged', () => {
    const user = aSavedUser()
    const newHash = 'mock$new' as PasswordHash

    expect(changeUserPassword(user, user.id, newHash)).toEqual({
      ok: true,
      value: {
        state: { ...user, passwordHash: newHash },
        events: [
          { type: 'UserPasswordChanged', payload: { userId: 'user-1' } },
        ],
      },
    })
  })

  it('returns ForbiddenError for anyone but the user', () => {
    const result = changeUserPassword(
      aSavedUser(),
      toUserId('user-2'),
      'mock$new' as PasswordHash
    )

    expect(result).toEqual({ ok: false, error: new ForbiddenError() })
  })
})

describe('rehashUserPassword', () => {
  it('stores the stronger hash of the same password, raising nothing', () => {
    const user = aSavedUser()
    const newHash = 'scrypt$stronger' as PasswordHash

    expect(rehashUserPassword(user, newHash)).toEqual({
      state: { ...user, passwordHash: newHash },
      events: [],
    })
  })
})
