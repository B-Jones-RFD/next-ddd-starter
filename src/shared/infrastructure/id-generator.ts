import { uuidv7 } from '@/shared/infrastructure/uuid-v7'
import type { IIdGenerator } from '@/shared/kernel/ports/id-generator.port'

/** Time-ordered UUID v7s. */
export class IdGenerator implements IIdGenerator {
  next(): string {
    return uuidv7()
  }
}
