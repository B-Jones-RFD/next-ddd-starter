import { describe, expect, it } from 'vitest'

import { serializeError } from '@/shared/infrastructure/logging/serialize-error'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'

describe('serializeError', () => {
  it('keeps only the fixed list, with declared AppError data, along the cause chain', () => {
    const driver = Object.assign(new Error('database is locked'), {
      errcode: 5,
      sql: 'SELECT secret FROM users',
    })
    const outage = new PersistenceError('IUserRepository', {
      retryable: true,
      cause: driver,
    })

    const serialized = serializeError(outage)

    expect(serialized).toEqual({
      type: 'PersistenceError',
      message: 'IUserRepository failed to reach the database',
      stack: expect.any(String),
      code: 'persistence',
      retryable: true,
      port: 'IUserRepository',
      cause: {
        type: 'Error',
        message: 'database is locked',
        stack: expect.any(String),
      },
    })
  })

  it('records the field names of a validation error', () => {
    expect(
      serializeError(new ValidationError({ email: 'invalid' }))
    ).toMatchObject({ code: 'validation', fields: { email: 'invalid' } })
  })

  it('describes a thrown non-error by its type only', () => {
    expect(serializeError('ada@example.com')).toEqual({ type: 'string' })
  })
})
