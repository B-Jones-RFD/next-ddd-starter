import { describe, expect, it } from 'vitest'

import { openDatabase } from '@/shared/infrastructure/sqlite/database'
import {
  query,
  toPersistenceError,
} from '@/shared/infrastructure/sqlite/translate-error'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'

const driverError = (errcode: number) =>
  Object.assign(new Error('driver failure'), {
    code: 'ERR_SQLITE_ERROR',
    errcode,
  })

describe('toPersistenceError', () => {
  it.each([
    ['SQLITE_BUSY', 5],
    ['SQLITE_BUSY_SNAPSHOT', 517],
    ['SQLITE_LOCKED', 6],
  ])('makes %s retryable, keeping the cause', (_name, errcode) => {
    const cause = driverError(errcode)

    const error = toPersistenceError('IUserRepository', cause)

    expect(error).toBeInstanceOf(PersistenceError)
    expect(error).toMatchObject({ port: 'IUserRepository', retryable: true })
    expect(error.cause).toBe(cause)
  })

  it('makes any other driver error non-retryable', () => {
    expect(
      toPersistenceError('IUserRepository', driverError(19)).retryable
    ).toBe(false)
  })
})

describe('query', () => {
  it('rethrows a driver error as a non-retryable PersistenceError', () => {
    const db = openDatabase(':memory:')

    expect(() =>
      query('IUserRepository', () => db.prepare('SELECT * FROM nope').all())
    ).toThrow(
      expect.objectContaining({
        constructor: PersistenceError,
        retryable: false,
      })
    )
  })
})
