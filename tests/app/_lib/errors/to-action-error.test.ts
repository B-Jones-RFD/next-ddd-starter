import { describe, expect, it } from 'vitest'

import { toActionError } from '@/app/_lib/errors/to-action-error'
import { EmailTakenError, ValidationError } from '@/modules/identity/api'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'

import { withTestSpan } from '@tests/fixtures/spans'

describe('toActionError', () => {
  it('puts identity.email-taken under the email field', () => {
    expect(toActionError(new EmailTakenError())).toEqual({
      code: 'identity.email-taken',
      message: 'That email is already registered.',
      fields: {
        email:
          'That email is already registered. Sign in, or use another email.',
      },
    })
  })

  it('words each invalid field of a validation error', () => {
    const error = new ValidationError({
      displayName: 'required',
      email: 'invalid',
      password: 'too-short',
    })

    expect(toActionError(error)).toEqual({
      code: 'validation',
      message: 'Check the fields below.',
      fields: {
        displayName: 'Enter a display name.',
        email: 'Enter an email address like name@example.com.',
        password: 'Use at least 8 characters.',
      },
    })
  })

  it('turns anything thrown into unexpected, with the trace id as its reference', async () => {
    const outage = new PersistenceError('IUserRepository', { retryable: true })

    const { error, traceId } = await withTestSpan((traceId) => ({
      error: toActionError(outage),
      traceId,
    }))

    expect(error).toEqual({
      code: 'unexpected',
      message:
        'Something went wrong on our side. Try again, and if it keeps happening, report the reference below.',
      reference: traceId,
    })
  })

  it('still gives a reference in trace-id format when no span is active', () => {
    const error = toActionError(new TypeError('boom'))

    expect(error.code).toBe('unexpected')
    expect(error.reference).toMatch(/^[0-9a-f]{32}$/)
  })
})
