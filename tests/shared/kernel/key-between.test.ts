import { describe, expect, it } from 'vitest'

import { keyBetween } from '@/shared/kernel/key-between'

describe('keyBetween', () => {
  it('gives the first key in an empty order', () => {
    expect(keyBetween(null, null)).toBe('V')
  })

  it('gives a key after the last one', () => {
    expect(keyBetween('V', null)).toBe('l')
  })

  it('gives a key before the first one', () => {
    expect(keyBetween(null, 'V')).toBe('G')
  })

  it('gives a key halfway between two keys', () => {
    expect(keyBetween('F', 'V')).toBe('N')
  })

  it('makes the key longer when two keys are adjacent', () => {
    expect(keyBetween('V', 'W')).toBe('VV')
  })

  it('keeps every key strictly between its neighbours, however often it splits', () => {
    let low: string | null = 'V'
    let high: string | null = 'W'
    for (let i = 0; i < 200; i += 1) {
      const key = keyBetween(low, high)
      expect(low !== null && low < key).toBe(true)
      expect(high !== null && key < high).toBe(true)
      if (i % 2 === 0) low = key
      else high = key
    }
  })

  it('appends and prepends in order', () => {
    const keys = ['V']
    for (let i = 0; i < 100; i += 1) {
      keys.push(keyBetween(keys.at(-1) ?? null, null))
      keys.unshift(keyBetween(null, keys[0] ?? null))
    }

    expect([...keys].sort()).toEqual(keys)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it.each([
    ['V', 'V'],
    ['W', 'V'],
  ])('throws for keys out of order (%s, %s)', (a, b) => {
    expect(() => keyBetween(a, b)).toThrow()
  })

  it.each(['', 'V0', 'a-b'])('throws for the invalid key %j', (key) => {
    expect(() => keyBetween(key, null)).toThrow()
  })
})
