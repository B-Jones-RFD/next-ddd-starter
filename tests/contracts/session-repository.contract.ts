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

    it('writes its events as domain rows', async () => {
      const { repository, outbox } = make()
      const session = aSession()

      await repository.save(
        session,
        [{ type: 'SessionStarted', payload: { userId: session.userId } }],
        { actorId: session.userId, causationId: null }
      )

      const rows = await outbox.pending(10)
      expect(rows.map((row) => [row.scope, row.envelope.type])).toEqual([
        ['domain', 'SessionStarted'],
      ])
    })
  })
}
