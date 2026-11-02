import { getInjection } from '@/di/container'
import type { Task } from '@/modules/boards/domain/task/task'
import type { TaskEvent } from '@/modules/boards/domain/task/task.events'
import type { ConflictError } from '@/shared/kernel/errors/app-error'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'
import type { EventOrigin } from '@/shared/kernel/events'

/** Tries per task before leaving a task that keeps changing for later. */
const ATTEMPTS = 3

/**
 * Applies a Consequence to each task, one transaction per task, reloading a
 * task that changed meanwhile and changing it from its new state. A task
 * still conflicting after a few tries doesn't stop the rest: every other
 * task is changed first, then this throws a retryable `PersistenceError`
 * (the last conflict as `cause`), so the relay redelivers the event later
 * (§6). `change` must be idempotent by state, so a redelivery changes only
 * what is left.
 */
export async function changeEachTask(
  found: readonly Task[],
  change: (task: Task) => { state: Task; events: TaskEvent[] },
  origin: EventOrigin
): Promise<void> {
  const tasks = await getInjection('ITaskRepository')
  let leftOver: ConflictError | undefined
  for (const loaded of found) {
    let task = loaded
    for (let attempt = 1; ; attempt += 1) {
      const changed = change(task)
      if (changed.events.length === 0) break
      const saved = await tasks.save(changed.state, changed.events, origin)
      if (saved.ok) break
      if (attempt === ATTEMPTS) {
        leftOver = saved.error
        break
      }
      // Someone edited the task meanwhile: change it from its new state.
      const reloaded = await tasks.findById(task.id)
      if (!reloaded.ok) break
      task = reloaded.value
    }
  }
  if (leftOver) {
    throw new PersistenceError('ITaskRepository', {
      retryable: true,
      cause: leftOver,
      message: 'A task kept changing under a Consequence; redeliver the event',
    })
  }
}
