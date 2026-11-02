import { describe, expect, it } from 'vitest'

import type { Email } from '@/modules/identity/domain/user/email'
import type { IUserRepository } from '@/modules/identity/domain/user/user-repository.port'
import type { UserEvent } from '@/modules/identity/domain/user/user.events'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { toUserId } from '@/shared/kernel/user-id'

import { aUser } from '@tests/fixtures/identity'

type Make = () => { repository: IUserRepository; outbox: IOutbox }

const registered = (userId: string, displayName: string): UserEvent => ({
  type: 'UserRegistered',
  payload: { userId: toUserId(userId), displayName },
})

/** What every `IUserRepository` adapter must do, with its context's outbox. */
export function describeUserRepositoryContract(make: Make) {
  describe('IUserRepository contract', () => {
    it('saves a new user at version 1, found by id and by email', async () => {
      const { repository } = make()
      const user = aUser()

      const saved = await repository.save(user, [], {
        actorId: user.id,
        causationId: null,
      })

      expect(saved).toEqual({ ok: true, value: { ...user, version: 1 } })
      expect(await repository.findById(user.id)).toEqual(saved)
      expect(await repository.findByEmail(user.email)).toEqual(saved)
    })

    it('returns NotFoundError for an unknown id or email', async () => {
      const { repository } = make()

      const byId = await repository.findById(toUserId('nobody'))
      const byEmail = await repository.findByEmail(
        'nobody@example.com' as Email
      )

      expect(byId).toEqual({
        ok: false,
        error: new NotFoundError('User', 'nobody'),
      })
      expect(byEmail.ok).toBe(false)
      expect(!byEmail.ok && byEmail.error).toBeInstanceOf(NotFoundError)
    })

    it('rejects a new user whose email is taken, writing nothing', async () => {
      const { repository, outbox } = make()
      const first = aUser()
      await repository.save(first, [], { actorId: first.id, causationId: null })
      const second = aUser({ email: first.email })

      const result = await repository.save(
        second,
        [registered(second.id, 'Twin')],
        { actorId: second.id, causationId: null }
      )

      expect(result).toEqual({
        ok: false,
        error: new ConflictError('User', second.id),
      })
      expect(await outbox.pending(10)).toEqual([])
    })

    it('rejects a stale version with ConflictError, writing nothing', async () => {
      const { repository, outbox } = make()
      const user = aUser()
      const saved = await repository.save(user, [], {
        actorId: user.id,
        causationId: null,
      })
      if (!saved.ok) throw new Error('setup failed')
      await repository.save(saved.value, [], {
        actorId: user.id,
        causationId: null,
      })

      const stale = await repository.save(
        saved.value,
        [registered(user.id, 'Stale')],
        { actorId: user.id, causationId: null }
      )

      expect(stale).toEqual({
        ok: false,
        error: new ConflictError('User', user.id),
      })
      expect(await outbox.pending(10)).toEqual([])
    })

    it('writes each event as a domain row and its translation as an integration row', async () => {
      const { repository, outbox } = make()
      const user = aUser()

      await repository.save(user, [registered(user.id, user.displayName)], {
        actorId: user.id,
        causationId: null,
      })

      const rows = await outbox.pending(10)
      expect(rows.map((row) => [row.scope, row.envelope.type])).toEqual([
        ['domain', 'UserRegistered'],
        ['integration', 'identity.UserRegistered'],
      ])
      expect(rows[1]?.envelope).toMatchObject({
        version: 1,
        aggregateId: user.id,
        aggregateVersion: 1,
        actorId: user.id,
        causationId: null,
        payload: { userId: user.id, displayName: user.displayName },
      })
    })
  })
}
