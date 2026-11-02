import { describe, expect, it } from 'vitest'

import {
  endSession,
  isSessionActive,
  isTouchDue,
  signOutSession,
  startSession,
  touchSession,
  type Session,
  type SessionId,
  type TokenHash,
} from '@/modules/identity/domain/session/session'
import { toUserId } from '@/shared/kernel/user-id'

const started = new Date('2026-01-01T10:00:00.000Z')
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

const at = (ms: number) => new Date(started.getTime() + ms)

function aSession(overrides: Partial<Session> = {}): Session {
  return {
    ...startSession({
      id: 'session-1' as SessionId,
      userId: toUserId('user-1'),
      tokenHash: 'hash-1' as TokenHash,
      now: started,
    }).state,
    version: 1,
    ...overrides,
  }
}

describe('startSession', () => {
  it('starts a session for the user, seen now, and raises SessionStarted', () => {
    const { state, events } = startSession({
      id: 'session-1' as SessionId,
      userId: toUserId('user-1'),
      tokenHash: 'hash-1' as TokenHash,
      now: started,
    })

    expect(state).toEqual({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hash-1',
      createdAt: started,
      lastSeenAt: started,
      endedAt: null,
      version: 0,
    })
    expect(events).toEqual([
      { type: 'SessionStarted', payload: { userId: 'user-1' } },
    ])
  })
})

describe('isSessionActive', () => {
  it('is active until 7 days without use', () => {
    const session = aSession()

    expect(isSessionActive(session, at(7 * DAY - 1))).toBe(true)
    expect(isSessionActive(session, at(7 * DAY))).toBe(false)
  })

  it('stays active while it is used, until 30 days in total', () => {
    const session = aSession({ lastSeenAt: at(29 * DAY) })

    expect(isSessionActive(session, at(30 * DAY - 1))).toBe(true)
    expect(isSessionActive(session, at(30 * DAY))).toBe(false)
  })

  it('is not active once ended', () => {
    const session = aSession({ endedAt: at(MINUTE) })

    expect(isSessionActive(session, at(2 * MINUTE))).toBe(false)
  })
})

describe('touchSession', () => {
  it('is due at most once a minute', () => {
    const session = aSession()

    expect(isTouchDue(session, at(MINUTE - 1))).toBe(false)
    expect(isTouchDue(session, at(MINUTE))).toBe(true)
  })

  it('marks the session seen now', () => {
    expect(touchSession(aSession(), at(5 * MINUTE)).lastSeenAt).toEqual(
      at(5 * MINUTE)
    )
  })
})

describe('signOutSession', () => {
  it('ends the session and raises SessionSignedOut', () => {
    const { state, events } = signOutSession(aSession(), {
      now: at(MINUTE),
      everywhere: false,
    })

    expect(state.endedAt).toEqual(at(MINUTE))
    expect(events).toEqual([
      {
        type: 'SessionSignedOut',
        payload: { userId: 'user-1', everywhere: false },
      },
    ])
  })

  it('changes nothing on a session that already ended', () => {
    const ended = aSession({ endedAt: at(MINUTE) })

    expect(
      signOutSession(ended, { now: at(2 * MINUTE), everywhere: true })
    ).toEqual({ state: ended, events: [] })
  })
})

describe('endSession', () => {
  it.each(['signed-out-everywhere', 'password-changed'] as const)(
    'ends the session because %s and raises SessionEnded',
    (reason) => {
      const { state, events } = endSession(aSession(), {
        now: at(MINUTE),
        reason,
      })

      expect(state.endedAt).toEqual(at(MINUTE))
      expect(events).toEqual([
        { type: 'SessionEnded', payload: { userId: 'user-1', reason } },
      ])
    }
  )

  it('changes nothing on a session that already ended', () => {
    const ended = aSession({ endedAt: at(MINUTE) })

    expect(
      endSession(ended, { now: at(2 * MINUTE), reason: 'password-changed' })
    ).toEqual({ state: ended, events: [] })
  })
})
