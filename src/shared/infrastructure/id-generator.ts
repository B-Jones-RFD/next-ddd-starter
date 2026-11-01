import { randomUUID } from 'node:crypto'

import type { IIdGenerator } from '@/shared/kernel/ports/id-generator.port'

export class IdGenerator implements IIdGenerator {
  next(): string {
    return randomUUID()
  }
}
