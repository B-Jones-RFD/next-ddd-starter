import type { IIdGenerator } from '@/shared/kernel/ports/id-generator.port'

/** Deterministic ids (`id-1`, `id-2`, …) so tests and seeds can predict them. */
export class MockIdGenerator implements IIdGenerator {
  private counter = 0

  next(): string {
    this.counter += 1
    return `id-${this.counter}`
  }
}
