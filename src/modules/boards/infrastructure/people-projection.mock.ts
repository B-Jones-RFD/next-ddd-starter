import type {
  IPeopleProjection,
  Person,
  Receipt,
} from '@/modules/boards/application/ports/people-projection.port'
import { mockStore } from '@/shared/infrastructure/mock-stores'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

type Store = {
  people: Map<string, { person: Person; aggregateVersion: number }>
  inbox: Set<string>
}

/** The mock people store, shared with `MockBoardReader`. */
export function mockPeople(): Store {
  return mockStore('boards.people', () => ({
    people: new Map(),
    inbox: new Set<string>(),
  }))
}

/** In-memory twin of `PeopleProjection`: same inbox and version rules. */
export class MockPeopleProjection implements IPeopleProjection {
  private store(): Store {
    return mockPeople()
  }

  async record(
    person: Person,
    aggregateVersion: number,
    receipt: Receipt
  ): Promise<void> {
    const { people, inbox } = this.store()
    const key = `${receipt.eventId}|${receipt.handler}`
    if (inbox.has(key)) return
    inbox.add(key)
    const stored = people.get(person.userId)
    if (stored && stored.aggregateVersion >= aggregateVersion) return
    people.set(person.userId, { person: { ...person }, aggregateVersion })
  }

  async find(userId: UserId): Promise<Result<Person, NotFoundError>> {
    const stored = this.store().people.get(userId)
    return stored
      ? ok({ ...stored.person })
      : err(new NotFoundError('Person', userId))
  }
}
