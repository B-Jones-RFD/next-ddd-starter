/**
 * An error as a form shows it: plain and serializable, with all wording
 * decided in `to-action-error` (§7).
 */
export type ActionError = {
  /** The error's `code`, or `unexpected` for anything thrown. */
  code: string
  /** Shown in the form's alert. */
  message: string
  /** Shown under each named input. */
  fields?: Record<string, string>
  /** The trace id an `unexpected` failure can be reported with. */
  reference?: string
}
