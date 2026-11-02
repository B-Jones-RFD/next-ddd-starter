import { describe, expect, it } from 'vitest'

import type {
  Session,
  SessionId,
  TokenHash,
} from '@/modules/identity/domain/session/session'
import type { ISessionRepository } from '@/modules/identity/domain/session/session-repository.port'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { toUserId } from '@/shared/kernel/user-id'

type Make = () => { repository: ISessionRepository; outbox: IOutbox }

const later = new Date('2026-01-02T10:00:00.000Z')

let sequence = 0
function aSession(): Session {
  sequence += 1
  const now = new Date('2026-01-01T10:00:00.000Z')
  return {
    id: `session-${sequence}` as SessionId,
    userId: toUserId(`user-${sequence}`),
    tokenHash: `hash-${sequence}` as TokenHash,
    createdAt: now,
    lastSeenAt: now,
    endedAt: null,
    version: 0,
  }
}

/** What every `ISessionRepository` adapter must do, with its context's outbox. */
export function describeSessionRepositoryContract(make: Make) {
  describe('ISessionRepository contract', () => {
    it('saves a new session at version 1, found by its token hash', async () => {
      const { repository } = make()
      const session = aSession()

      const saved = await repository.save(session, [], {
        actorId: session.userId,
        causationId: null,
      })

      expect(saved).toEqual({ ok: true, value: { ...session, version: 1 } })
      expect(await repository.findByTokenHash(session.tokenHash)).toEqual(saved)
    })

    it('returns NotFoundError for an unknown token hash', async () => {
      const { repository } = make()

      const result = await repository.findByTokenHash('unknown' as TokenHash)

      expect(result.ok).toBe(false)
      expect(!result.ok && result.error).toBeInstanceOf(NotFoundError)
    })

    it('rejects a stale version with ConflictError', async () => {
      const { repository } = make()
      const session = aSession()
      const origin = { actorId: session.userId, causationId: null }
      const saved = await repository.save(session, [], origin)
      if (!saved.ok) throw new Error('setup failed')
      await repository.save(saved.value, [], origin)

      expect(await repository.save(saved.value, [], origin)).toEqual({
        ok: false,
        error: new ConflictError('Session', session.id),
      })
    })

    it('writes each event as a domain row and its translation as an integration row', async () => {
      const { repository, outbox } = make()
      const session = aSession()
      const origin = { actorId: session.userId, causationId: null }

      const saved = await repository.save(
        session,
        [{ type: 'SessionStarted', payload: { userId: session.userId } }],
        origin
      )
      if (!saved.ok) throw new Error('setup failed')
      await repository.save(
        { ...saved.value, endedAt: later },
        [
          {
            type: 'SessionSignedOut',
            payload: { userId: session.userId, everywhere: true },
          },
        ],
        origin
      )

      const rows = await outbox.pending(10)
      expect(rows.map((row) => [row.scope, row.envelope.type])).toEqual([
        ['domain', 'SessionStarted'],
        ['integration', 'identity.UserSignedIn'],
        ['domain', 'SessionSignedOut'],
        ['integration', 'identity.UserSignedOut'],
      ])
      expect(rows.map((row) => row.envelope.payload)).toEqual([
        { userId: session.userId },
        { userId: session.userId },
        { userId: session.userId, everywhere: true },
        { userId: session.userId, everywhere: true },
      ])
    })

    it('publishes nothing for a session ended as a consequence', async () => {
      const { repository, outbox } = make()
      const session = aSession()

      await repository.save(
        session,
        [
          {
            type: 'SessionEnded',
            payload: { userId: session.userId, reason: 'password-changed' },
          },
        ],
        { actorId: session.userId, causationId: null }
      )

      const rows = await outbox.pending(10)
      expect(rows.map((row) => row.scope)).toEqual(['domain'])
    })

    it('keeps an ended session, with when it ended', async () => {
      const { repository } = make()
      const session = aSession()
      const origin = { actorId: session.userId, causationId: null }
      const saved = await repository.save(session, [], origin)
      if (!saved.ok) throw new Error('setup failed')

      await repository.save({ ...saved.value, endedAt: later }, [], origin)

      expect(await repository.findByTokenHash(session.tokenHash)).toEqual({
        ok: true,
        value: { ...session, endedAt: later, version: 2 },
      })
    })

    it('finds every session of a user', async () => {
      const { repository } = make()
      const first = aSession()
      const second = { ...aSession(), userId: first.userId }
      const stranger = aSession()
      for (const session of [first, second, stranger]) {
        await repository.save(session, [], {
          actorId: session.userId,
          causationId: null,
        })
      }

      const found = await repository.findByUserId(first.userId)

      expect(found.map((session) => session.id).sort()).toEqual(
        [first.id, second.id].sort()
      )
    })

    it('touches lastSeenAt without changing the version or writing events', async () => {
      const { repository, outbox } = make()
      const session = aSession()
      await repository.save(session, [], {
        actorId: session.userId,
        causationId: null,
      })

      await repository.touch(session.id, later)

      expect(await repository.findByTokenHash(session.tokenHash)).toEqual({
        ok: true,
        value: { ...session, lastSeenAt: later, version: 1 },
      })
      expect(await outbox.pending(10)).toEqual([])
    })
  })
}
