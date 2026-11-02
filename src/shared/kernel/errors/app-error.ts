/** Data an error declares about itself: codes, ids and field names only. */
export type ErrorData = Readonly<
  Record<string, string | number | boolean | Readonly<Record<string, string>>>
>

/**
 * The root of every error the app raises (§7). `code` is a stable literal that
 * `app/` keys its wording on.
 *
 * `message` is for developers only: constant text plus codes, ids and field
 * names (`Task ${taskId} not found`), never a value from input. It reaches
 * diagnostic logs and spans, and users never see it.
 */
export abstract class AppError extends Error {
  abstract readonly code: string

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
  }

  /** The declared data the diagnostic log's `err` serializer records. */
  get data(): ErrorData {
    return {}
  }
}

/** Returned by a port when the thing asked for doesn't exist. */
export class NotFoundError extends AppError {
  readonly code = 'not-found'

  constructor(
    readonly entity: string,
    readonly id: string
  ) {
    super(`${entity} ${id} not found`)
  }

  override get data(): ErrorData {
    return { entity: this.entity, id: this.id }
  }
}

/** Returned by `save()` when the aggregate changed since it was loaded. */
export class ConflictError extends AppError {
  readonly code = 'conflict'

  constructor(
    readonly entity: string,
    readonly id: string
  ) {
    super(`${entity} ${id} was changed since it was loaded`)
  }

  override get data(): ErrorData {
    return { entity: this.entity, id: this.id }
  }
}

/** Returned when a request has no valid session. */
export class UnauthenticatedError extends AppError {
  readonly code = 'unauthenticated'

  constructor() {
    super('No valid session')
  }
}
