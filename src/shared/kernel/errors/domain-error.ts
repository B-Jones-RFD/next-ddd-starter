import { AppError, type ErrorData } from '@/shared/kernel/errors/app-error'

/** An expected outcome of a domain rule. Rule errors extend it. */
export abstract class DomainError extends AppError {}

// #region field-issues
/**
 * What was wrong with a field. `app/` turns each code into wording for its
 * field.
 */
export type FieldIssue = 'required' | 'too-short' | 'too-long' | 'invalid'

/** Field name → issue. */
export type FieldIssues = Readonly<Record<string, FieldIssue>>
// #endregion field-issues

/** One or more fields failed their parse rules or the input schema. */
export class ValidationError extends DomainError {
  readonly code = 'validation'

  constructor(readonly fields: FieldIssues) {
    super(`Invalid fields: ${Object.keys(fields).join(', ')}`)
  }

  override get data(): ErrorData {
    return { fields: this.fields }
  }

  /**
   * Builds the error for input of the wrong shape, from an input schema's
   * issue paths: a top-level field that is missing is `required`, and any
   * other is `invalid`.
   */
  static fromShape(
    input: unknown,
    issues: readonly { path: readonly PropertyKey[] }[]
  ): ValidationError {
    const record =
      typeof input === 'object' && input !== null
        ? (input as Record<PropertyKey, unknown>)
        : {}
    const fields: Record<string, FieldIssue> = {}
    for (const { path } of issues) {
      const field = path[0]
      const name = typeof field === 'string' ? field : 'input'
      fields[name] = record[name] === undefined ? 'required' : 'invalid'
    }
    return new ValidationError(fields)
  }

  /** Combines the issues of several validation errors into one. */
  static merge(errors: readonly ValidationError[]): ValidationError {
    const fields: Record<string, FieldIssue> = {}
    for (const error of errors) Object.assign(fields, error.fields)
    return new ValidationError(fields)
  }
}

/** The actor may not do this. */
export class ForbiddenError extends DomainError {
  readonly code = 'forbidden'

  constructor() {
    super('Forbidden')
  }
}
