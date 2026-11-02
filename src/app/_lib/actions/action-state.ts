import type { ActionError } from '@/app/_lib/errors/action-error'

/**
 * What every Server Action returns (§10). An error echoes the submitted
 * `values`, so inputs refill through `defaultValue` after React resets the
 * form.
 */
export type ActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; error: ActionError; values: Record<string, string> }

export const IDLE: ActionState = { status: 'idle' }

/** The named fields of a form as strings, unchecked: the command validates. */
export function formValues<const Name extends string>(
  formData: FormData,
  names: readonly Name[]
): Record<Name, string> {
  const values = {} as Record<Name, string>
  for (const name of names) {
    const value = formData.get(name)
    values[name] = typeof value === 'string' ? value : ''
  }
  return values
}
