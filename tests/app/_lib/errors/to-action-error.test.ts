import { describe, expect, it } from 'vitest'

import { toActionError } from '@/app/_lib/errors/to-action-error'
import {
  AlreadyAMemberError,
  BoardArchivedError,
  BoardNameMismatchError,
  ListArchivedError,
  ListHasActiveTasksError,
  NotAMemberError,
  OwnerMustTransferFirstError,
  TaskArchivedError,
} from '@/modules/boards/api'
import {
  EmailTakenError,
  IncorrectPasswordError,
  InvalidCredentialsError,
  TooManyAttemptsError,
  ValidationError,
} from '@/modules/identity/api'
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

  it('words identity.invalid-credentials without saying which part was wrong', () => {
    expect(toActionError(new InvalidCredentialsError())).toEqual({
      code: 'identity.invalid-credentials',
      message: 'That email and password don’t match. Check them and try again.',
    })
  })

  it('words identity.too-many-attempts with when to try again', () => {
    expect(toActionError(new TooManyAttemptsError())).toEqual({
      code: 'identity.too-many-attempts',
      message:
        'Too many failed sign-ins for this email. Wait 15 minutes, then try again.',
    })
  })

  it('puts identity.incorrect-password under the current password field', () => {
    expect(toActionError(new IncorrectPasswordError())).toEqual({
      code: 'identity.incorrect-password',
      message: 'Your current password is incorrect.',
      fields: { currentPassword: 'That isn’t your current password.' },
    })
  })

  it('words the password change fields', () => {
    const error = new ValidationError({
      currentPassword: 'required',
      newPassword: 'too-short',
    })

    expect(toActionError(error).fields).toEqual({
      currentPassword: 'Enter your current password.',
      newPassword: 'Use at least 8 characters.',
    })
  })

  it('words the board name field', () => {
    expect(
      toActionError(new ValidationError({ name: 'required' })).fields
    ).toEqual({ name: 'Enter a name.' })
    expect(
      toActionError(new ValidationError({ name: 'too-long' })).fields
    ).toEqual({ name: 'Use 60 characters or fewer.' })
  })

  // #region code-case
  it('words boards.board.already-a-member', () => {
    expect(toActionError(new AlreadyAMemberError())).toEqual({
      code: 'boards.board.already-a-member',
      message: 'They’re already a member of this board.',
    })
  })
  // #endregion code-case

  it('words boards.board.not-a-member', () => {
    expect(toActionError(new NotAMemberError())).toEqual({
      code: 'boards.board.not-a-member',
      message:
        'They’re no longer a member of this board. Reload the page to see who is.',
    })
  })

  it('words boards.board.owner-must-transfer-first', () => {
    expect(toActionError(new OwnerMustTransferFirstError())).toEqual({
      code: 'boards.board.owner-must-transfer-first',
      message:
        'You’re the Owner. Make another member the Owner before you leave.',
    })
  })

  it('words the task title and description fields', () => {
    expect(
      toActionError(
        new ValidationError({ title: 'required', description: 'too-long' })
      ).fields
    ).toEqual({
      title: 'Enter a title.',
      description: 'Use 5000 characters or fewer.',
    })
    expect(
      toActionError(new ValidationError({ title: 'too-long' })).fields
    ).toEqual({ title: 'Use 200 characters or fewer.' })
  })

  it('words boards.list.archived', () => {
    expect(toActionError(new ListArchivedError())).toEqual({
      code: 'boards.list.archived',
      message:
        'That list is archived. Restore the list first, or reload the page and choose another list.',
    })
  })

  it('words boards.list.has-active-tasks with what to do first', () => {
    expect(toActionError(new ListHasActiveTasksError())).toEqual({
      code: 'boards.list.has-active-tasks',
      message:
        'This list still has active tasks. Archive them or move them to another list first.',
    })
  })

  it('words boards.task.archived', () => {
    expect(toActionError(new TaskArchivedError())).toEqual({
      code: 'boards.task.archived',
      message: 'This task is archived. Restore it to change it.',
    })
  })

  it('words boards.board.archived', () => {
    expect(toActionError(new BoardArchivedError())).toEqual({
      code: 'boards.board.archived',
      message: 'This board is archived. The Owner can restore it.',
    })
  })

  it('puts boards.board.name-mismatch under the confirm name field', () => {
    expect(toActionError(new BoardNameMismatchError())).toEqual({
      code: 'boards.board.name-mismatch',
      message: 'The name you typed doesn’t match the board’s name.',
      fields: { confirmName: 'Type the board’s name exactly as shown.' },
    })
  })

  it('words the confirm name field', () => {
    expect(
      toActionError(new ValidationError({ confirmName: 'required' })).fields
    ).toEqual({ confirmName: 'Type the board’s name to confirm.' })
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
