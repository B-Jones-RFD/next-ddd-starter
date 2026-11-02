import { describe, expect, it } from 'vitest'

import type { IPeopleProjection } from '@/modules/boards/application/ports/people-projection.port'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { toUserId } from '@/shared/kernel/user-id'

const ada = toUserId('user-ada')
const receipt = (eventId: string) => ({
  eventId,
  handler: 'boards.recordUserRegistered',
})

/** What every `IPeopleProjection` adapter must do. */
export function describePeopleProjectionContract(
  make: () => IPeopleProjection
) {
  describe('IPeopleProjection contract', () => {
    it('records a person, found by user id', async () => {
      const people = make()

      await people.record(
        { userId: ada, displayName: 'Ada' },
        1,
        receipt('event-1')
      )

      expect(await people.find(ada)).toEqual({
        ok: true,
        value: { userId: ada, displayName: 'Ada' },
      })
    })

    it('returns NotFoundError for someone it never heard of', async () => {
      expect(await make().find(ada)).toEqual({
        ok: false,
        error: new NotFoundError('Person', ada),
      })
    })

    it('applies a newer version', async () => {
      const people = make()
      await people.record({ userId: ada, displayName: 'Ada' }, 1, receipt('e1'))

      await people.record(
        { userId: ada, displayName: 'Ada L.' },
        2,
        receipt('e2')
      )

      const found = await people.find(ada)
      expect(found.ok && found.value.displayName).toBe('Ada L.')
    })

    it('ignores a version older than the one it applied', async () => {
      const people = make()
      await people.record(
        { userId: ada, displayName: 'Ada L.' },
        2,
        receipt('e2')
      )

      await people.record({ userId: ada, displayName: 'Ada' }, 1, receipt('e1'))

      const found = await people.find(ada)
      expect(found.ok && found.value.displayName).toBe('Ada L.')
    })

    it('drops an event its handler already applied', async () => {
      const people = make()
      await people.record({ userId: ada, displayName: 'Ada' }, 1, receipt('e1'))
      await people.record(
        { userId: ada, displayName: 'Ada L.' },
        2,
        receipt('e2')
      )

      await people.record(
        { userId: ada, displayName: 'Ada (again)' },
        3,
        receipt('e1')
      )

      const found = await people.find(ada)
      expect(found.ok && found.value.displayName).toBe('Ada L.')
    })
  })
}
