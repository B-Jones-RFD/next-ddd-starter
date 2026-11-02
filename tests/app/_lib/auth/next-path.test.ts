import { describe, expect, it } from 'vitest'

import { safeNextPath, signInPath } from '@/app/_lib/auth/next-path'

describe('safeNextPath', () => {
  it.each(['/boards', '/boards/b-1?view=list#top', '/account'])(
    'keeps the same-origin path %j',
    (next) => {
      expect(safeNextPath(next)).toBe(next)
    }
  )

  it.each([
    undefined,
    '',
    'boards',
    'https://evil.example/boards',
    '//evil.example/boards',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    ' /boards',
  ])('falls back to /boards for %j', (next) => {
    expect(safeNextPath(next)).toBe('/boards')
  })
})

describe('signInPath', () => {
  it('carries the path to return to', () => {
    expect(signInPath('/boards/b-1?view=list')).toBe(
      '/sign-in?next=%2Fboards%2Fb-1%3Fview%3Dlist'
    )
  })
})
