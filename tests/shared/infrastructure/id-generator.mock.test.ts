import { beforeEach, describe, expect, it } from 'vitest'

import { MockIdGenerator } from '@/shared/infrastructure/id-generator.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

describe('MockIdGenerator', () => {
  beforeEach(() => {
    resetMockStores()
  })

  it('mints predictable ids in order', () => {
    const ids = new MockIdGenerator()

    expect([ids.next(), ids.next(), ids.next()]).toEqual([
      'id-1',
      'id-2',
      'id-3',
    ])
  })

  it('continues the sequence across instances until the stores reset', () => {
    new MockIdGenerator().next()

    expect(new MockIdGenerator().next()).toBe('id-2')
  })
})
