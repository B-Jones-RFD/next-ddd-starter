import { describe, expect, it } from 'vitest'

import { pickAdapterMode } from '@/di/container'

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv

describe('pickAdapterMode', () => {
  it.each([
    [
      { ADAPTERS: 'mock', NODE_ENV: 'development', DATABASE_PATH: 'x.db' },
      'mock',
    ],
    [{ ADAPTERS: 'real', NODE_ENV: 'test' }, 'real'],
    [{ NODE_ENV: 'test', DATABASE_PATH: 'x.db' }, 'mock'],
    [{ NODE_ENV: 'development', DATABASE_PATH: 'x.db' }, 'real'],
    [{ NODE_ENV: 'development' }, 'mock'],
    [{ NODE_ENV: 'production', DATABASE_PATH: 'x.db' }, 'real'],
  ])('picks the mode for %o', (vars, mode) => {
    expect(pickAdapterMode(env(vars))).toBe(mode)
  })

  it('refuses mock mode in production', () => {
    expect(() =>
      pickAdapterMode(env({ NODE_ENV: 'production', ADAPTERS: 'mock' }))
    ).toThrow('mock')
  })

  it('refuses to start production with a required variable missing', () => {
    expect(() => pickAdapterMode(env({ NODE_ENV: 'production' }))).toThrow(
      'DATABASE_PATH'
    )
  })

  it('rejects an unknown ADAPTERS value', () => {
    expect(() => pickAdapterMode(env({ ADAPTERS: 'fake' }))).toThrow('ADAPTERS')
  })
})
