import { AppError } from '@/shared/kernel/errors/app-error'

export type SerializedError = {
  type: string
  message?: string
  stack?: string
  code?: string
  retryable?: boolean
  cause?: SerializedError
  [data: string]: unknown
}

const MAX_DEPTH = 10

/**
 * The diagnostic log's `err` serializer (§8): `type`, `message`, `stack`,
 * `code`, `retryable` and an `AppError`'s declared data, along the `cause`
 * chain. Nothing else a library attaches is copied (ADR 0017).
 */
export function serializeError(error: unknown, depth = 0): SerializedError {
  if (!(error instanceof Error)) return { type: typeof error }

  const serialized: SerializedError = {
    type: error.name,
    message: error.message,
    stack: error.stack,
  }
  if (error instanceof AppError) {
    serialized.code = error.code
    Object.assign(serialized, error.data)
  }
  if (error.cause !== undefined && depth < MAX_DEPTH) {
    serialized.cause = serializeError(error.cause, depth + 1)
  }
  return serialized
}
