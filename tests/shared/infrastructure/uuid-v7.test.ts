import { describe, expect, it } from 'vitest'

import { uuidv7 } from '@/shared/infrastructure/uuid-v7'

const V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuidv7', () => {
  it('makes RFC 9562 version 7 ids', () => {
    expect(uuidv7()).toMatch(V7)
  })

  it('keeps ids made one after another in order, even within a millisecond', () => {
    const ids = Array.from({ length: 1000 }, () => uuidv7())

    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
