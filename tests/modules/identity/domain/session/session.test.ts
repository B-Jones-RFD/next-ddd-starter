import { describe, expect, it } from 'vitest'

import {
  startSession,
  type SessionId,
  type TokenHash,
} from '@/modules/identity/domain/session/session'
import { toUserId } from '@/shared/kernel/user-id'

describe('startSession', () => {
  it('starts a session for the user, seen now, and raises SessionStarted', () => {
    const now = new Date('2026-01-01T10:00:00.000Z')

    const { state, events } = startSession({
      id: 'session-1' as SessionId,
      userId: toUserId('user-1'),
      tokenHash: 'hash-1' as TokenHash,
      now,
    })

    expect(state).toEqual({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hash-1',
      createdAt: now,
      lastSeenAt: now,
      version: 0,
    })
    expect(events).toEqual([
      { type: 'SessionStarted', payload: { userId: 'user-1' } },
    ])
  })
})
