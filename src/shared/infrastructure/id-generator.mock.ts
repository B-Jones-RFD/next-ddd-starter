import { mockStore } from '@/shared/infrastructure/mock-stores'
import type { IIdGenerator } from '@/shared/kernel/ports/id-generator.port'

/** Deterministic ids (`id-1`, `id-2`, …) so tests and seeds can predict them. */
export class MockIdGenerator implements IIdGenerator {
  next(): string {
    const store = mockStore('ids', () => ({ counter: 0 }))
    store.counter += 1
    return `id-${store.counter}`
  }
}
