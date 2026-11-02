import type { Brand } from '@/shared/kernel/brand'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/** What a task says the work is. */
export type TaskTitle = Brand<string, 'TaskTitle'>

export const TASK_TITLE_MAX_LENGTH = 200

/** Trims, then requires 1 to 200 characters. */
export function parseTaskTitle(
  raw: string
): Result<TaskTitle, ValidationError> {
  const value = raw.trim()
  if (value.length === 0) {
    return err(new ValidationError({ title: 'required' }))
  }
  if (value.length > TASK_TITLE_MAX_LENGTH) {
    return err(new ValidationError({ title: 'too-long' }))
  }
  return ok(value as TaskTitle)
}
