import { AppError, type ErrorData } from '@/shared/kernel/errors/app-error'

type InfrastructureErrorOptions = {
  retryable: boolean
  cause?: unknown
  message?: string
}

// #region infrastructure-error
/**
 * An outage, translated by an adapter. It is thrown, never returned (§7).
 * `port` names the port whose adapter failed, and `retryable` says whether
 * trying again later may succeed.
 */
export abstract class InfrastructureError extends AppError {
  readonly retryable: boolean

  constructor(
    readonly port: string,
    message: string,
    options: InfrastructureErrorOptions
  ) {
    super(options.message ?? message, { cause: options.cause })
    this.retryable = options.retryable
  }

  override get data(): ErrorData {
    return { port: this.port, retryable: this.retryable }
  }
}

/** The database failed. */
export class PersistenceError extends InfrastructureError {
  readonly code = 'persistence'

  constructor(port: string, options: InfrastructureErrorOptions) {
    super(port, `${port} failed to reach the database`, options)
  }
}
// #endregion infrastructure-error

/**
 * An external service failed. Unused here: it is the pattern for apps that
 * call external services (§13).
 */
export class ExternalServiceError extends InfrastructureError {
  readonly code = 'external-service'

  constructor(port: string, options: InfrastructureErrorOptions) {
    super(port, `${port} failed to reach its service`, options)
  }
}
