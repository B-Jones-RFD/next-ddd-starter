import { describe, expect, it } from 'vitest'

import { MockIdGenerator } from '@/shared/infrastructure/id-generator.mock'

describe('MockIdGenerator', () => {
  it('mints predictable ids in order', () => {
    const ids = new MockIdGenerator()

    expect([ids.next(), ids.next(), ids.next()]).toEqual([
      'id-1',
      'id-2',
      'id-3',
    ])
  })
})
