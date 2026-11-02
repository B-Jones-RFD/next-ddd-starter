import { describe, expect, it } from 'vitest'

import type { IUserReader } from '@/modules/identity/application/ports/user-reader.port'
import {
  SESSION_ABSOLUTE_LIMIT_MS,
  SESSION_IDLE_LIMIT_MS,
  type Session,
  type SessionId,
  type TokenHash,
} from '@/modules/identity/domain/session/session'
import type { ISessionRepository } from '@/modules/identity/domain/session/session-repository.port'
import type { User } from '@/modules/identity/domain/user/user'
import type { IUserRepository } from '@/modules/identity/domain/user/user-repository.port'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { toUserId } from '@/shared/kernel/user-id'

import { aUser } from '@tests/fixtures/identity'

type Make = () => {
  reader: IUserReader
  /** Arrange through the repositories the reader reads after. */
  users: IUserRepository
  sessions: ISessionRepository
}

const start = new Date('2026-01-01T10:00:00.000Z')
const at = (ms: number) => new Date(start.getTime() + ms)

let sequence = 0

/** What every `IUserReader` adapter must do. */
export function describeUserReaderContract(make: Make) {
  async function givenUser(adapters: ReturnType<Make>, user: User) {
    const saved = await adapters.users.save(user, [], {
      actorId: user.id,
      causationId: null,
    })
    if (!saved.ok) throw new Error('setup failed')
  }

  async function givenSession(
    adapters: ReturnType<Make>,
    user: User,
    overrides: Partial<Session> = {}
  ): Promise<Session> {
    sequence += 1
    const session: Session = {
      id: `session-reader-${sequence}` as SessionId,
      userId: user.id,
      tokenHash: `hash-reader-${sequence}` as TokenHash,
      createdAt: start,
      lastSeenAt: start,
      endedAt: null,
      version: 0,
      ...overrides,
    }
    const saved = await adapters.sessions.save(session, [], {
      actorId: user.id,
      causationId: null,
    })
    if (!saved.ok) throw new Error('setup failed')
    return session
  }

  describe('IUserReader contract', () => {
    describe('findSignedIn', () => {
      it('gives the user an active session signs in, with the session', async () => {
        const adapters = make()
        const ada = aUser({ displayName: 'Ada' as User['displayName'] })
        await givenUser(adapters, ada)
        const session = await givenSession(adapters, ada)

        expect(
          await adapters.reader.findSignedIn(session.tokenHash, at(1000))
        ).toEqual({
          actor: { userId: ada.id, displayName: 'Ada' },
          sessionId: session.id,
          lastSeenAt: start.toISOString(),
        })
      })

      it('gives null for an unknown token hash', async () => {
        const { reader } = make()

        expect(
          await reader.findSignedIn('unknown' as TokenHash, start)
        ).toBeNull()
      })

      it('gives null once the session has ended', async () => {
        const adapters = make()
        const ada = aUser()
        await givenUser(adapters, ada)
        const session = await givenSession(adapters, ada, { endedAt: start })

        expect(
          await adapters.reader.findSignedIn(session.tokenHash, at(1000))
        ).toBeNull()
      })

      it('gives null from the idle limit on, measured from the last use', async () => {
        const adapters = make()
        const ada = aUser()
        await givenUser(adapters, ada)
        const used = at(60_000)
        const session = await givenSession(adapters, ada, { lastSeenAt: used })
        const since = (ms: number) => new Date(used.getTime() + ms)

        expect(
          await adapters.reader.findSignedIn(
            session.tokenHash,
            since(SESSION_IDLE_LIMIT_MS - 1)
          )
        ).not.toBeNull()
        expect(
          await adapters.reader.findSignedIn(
            session.tokenHash,
            since(SESSION_IDLE_LIMIT_MS)
          )
        ).toBeNull()
      })

      it('gives null from the absolute limit on, however recently used', async () => {
        const adapters = make()
        const ada = aUser()
        await givenUser(adapters, ada)
        const session = await givenSession(adapters, ada, {
          lastSeenAt: at(SESSION_ABSOLUTE_LIMIT_MS - 60_000),
        })

        expect(
          await adapters.reader.findSignedIn(
            session.tokenHash,
            at(SESSION_ABSOLUTE_LIMIT_MS - 1)
          )
        ).not.toBeNull()
        expect(
          await adapters.reader.findSignedIn(
            session.tokenHash,
            at(SESSION_ABSOLUTE_LIMIT_MS)
          )
        ).toBeNull()
      })
    })

    describe('findByEmail', () => {
      it('finds a registered user by their stored email, for a registered actor', async () => {
        const adapters = make()
        const ada = aUser()
        const ben = aUser({
          displayName: 'Ben' as User['displayName'],
          email: 'ben@example.com' as User['email'],
        })
        await givenUser(adapters, ada)
        await givenUser(adapters, ben)

        expect(
          await adapters.reader.findByEmail(ada.id, 'ben@example.com')
        ).toEqual({
          ok: true,
          value: {
            userId: ben.id,
            displayName: 'Ben',
            email: 'ben@example.com',
          },
        })
      })

      it('returns NotFoundError for an email nobody registered', async () => {
        const adapters = make()
        const ada = aUser()
        await givenUser(adapters, ada)

        const result = await adapters.reader.findByEmail(
          ada.id,
          'nobody@example.com'
        )

        expect(!result.ok && result.error).toBeInstanceOf(NotFoundError)
      })

      it('returns ForbiddenError to an actor who isn’t a registered user', async () => {
        const adapters = make()
        const ben = aUser({ email: 'ben@example.com' as User['email'] })
        await givenUser(adapters, ben)

        expect(
          await adapters.reader.findByEmail(
            toUserId('user-never-registered'),
            'ben@example.com'
          )
        ).toEqual({ ok: false, error: new ForbiddenError() })
      })
    })
  })
}
