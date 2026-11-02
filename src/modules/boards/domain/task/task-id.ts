import type { Brand } from '@/shared/kernel/brand'

/** Which task. Crosses contexts only as a plain string (§2). */
export type TaskId = Brand<string, 'TaskId'>

/** Marks a string as a task id. Use it where an id enters from outside. */
export function toTaskId(value: string): TaskId {
  return value as TaskId
}
