import 'server-only'

import type { ActionError } from '@/app/_lib/errors/action-error'
import { logger, traceReference } from '@/shared/infrastructure/logging'

type Coded = Error & {
  code: string
  fields?: Readonly<Record<string, string>>
}

/** Wording for each field issue, per field, with a fallback per issue. */
const FIELD_WORDING: Record<string, Record<string, string>> = {
  displayName: {
    required: 'Enter a display name.',
    'too-long': 'Use 50 characters or fewer.',
  },
  email: {
    required: 'Enter an email address.',
    invalid: 'Enter an email address like name@example.com.',
    'too-long': 'Use 254 characters or fewer.',
  },
  password: {
    required: 'Enter a password.',
    'too-short': 'Use at least 8 characters.',
    'too-long': 'Use 128 characters or fewer.',
  },
}

const ISSUE_WORDING: Record<string, string> = {
  required: 'This field is required.',
  'too-short': 'This is too short.',
  'too-long': 'This is too long.',
  invalid: 'This isn’t valid.',
}

function fieldWording(fields: Readonly<Record<string, string>>) {
  return Object.fromEntries(
    Object.entries(fields).map(([field, issue]) => [
      field,
      FIELD_WORDING[field]?.[issue] ?? ISSUE_WORDING[issue] ?? 'Check this.',
    ])
  )
}

/** Wording for each expected error `code`. Anything else is unexpected. */
const WORDING: Record<string, (error: Coded) => Omit<ActionError, 'code'>> = {
  validation: (error) => ({
    message: 'Check the fields below.',
    fields: fieldWording(error.fields ?? {}),
  }),
  'identity.email-taken': () => ({
    message: 'That email is already registered.',
    fields: {
      email: 'That email is already registered. Sign in, or use another email.',
    },
  }),
  unauthenticated: () => ({ message: 'Sign in to continue.' }),
  forbidden: () => ({ message: 'You can’t do that here.' }),
  'not-found': () => ({
    message: 'That no longer exists. Reload the page to see what changed.',
  }),
  conflict: () => ({
    message: 'Someone else changed this. Reload the page and try again.',
  }),
}

function isCoded(error: unknown): error is Coded {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code in WORDING
  )
}

/**
 * The only place errors become plain objects for `app/` (§7). An expected
 * error gets the wording for its `code`. Anything else, which here means
 * anything thrown, becomes `unexpected` with the trace id as its reference,
 * and is logged once as `action.unexpected`.
 */
export function toActionError(error: unknown): ActionError {
  if (isCoded(error)) {
    const wording = WORDING[error.code]
    if (wording) return { code: error.code, ...wording(error) }
  }

  const reference = traceReference()
  logger.error('action.unexpected', { reference, err: error })
  return {
    code: 'unexpected',
    message:
      'Something went wrong on our side. Try again, and if it keeps happening, report the reference below.',
    reference,
  }
}
