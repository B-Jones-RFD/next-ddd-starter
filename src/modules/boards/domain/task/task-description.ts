import type { Brand } from '@/shared/kernel/brand'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/** The details of a task's work. It may be empty. */
export type TaskDescription = Brand<string, 'TaskDescription'>

export const TASK_DESCRIPTION_MAX_LENGTH = 5000

/** Trims, then allows up to 5000 characters. */
export function parseTaskDescription(
  raw: string
): Result<TaskDescription, ValidationError> {
  const value = raw.trim()
  if (value.length > TASK_DESCRIPTION_MAX_LENGTH) {
    return err(new ValidationError({ description: 'too-long' }))
  }
  return ok(value as TaskDescription)
}
