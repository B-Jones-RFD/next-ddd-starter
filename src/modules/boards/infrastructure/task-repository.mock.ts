import { translateTaskEvents } from '@/modules/boards/application/contracts/translate'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import type { Task } from '@/modules/boards/domain/task/task'
import type { TaskId } from '@/modules/boards/domain/task/task-id'
import type { ITaskRepository } from '@/modules/boards/domain/task/task-repository.port'
import type { TaskEvent } from '@/modules/boards/domain/task/task.events'
import { byPositionThenId } from '@/modules/boards/infrastructure/list-repository.mock'
import { mockStore } from '@/shared/infrastructure/mock-stores'
import { outboxEntries } from '@/shared/infrastructure/outbox/outbox-entries'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { err, ok, type Result } from '@/shared/kernel/result'

/** The mock tasks store, shared with `MockBoardReader`. */
export function mockTasks(): Map<string, Task> {
  return mockStore('boards.tasks', () => new Map<string, Task>())
}

/** In-memory twin of `TaskRepository`: same version rules and order. */
export class MockTaskRepository implements ITaskRepository {
  constructor(private readonly outbox: IOutbox) {}

  async findById(id: TaskId): Promise<Result<Task, NotFoundError>> {
    const task = mockTasks().get(id)
    return task ? ok(structuredClone(task)) : err(new NotFoundError('Task', id))
  }

  async findLastInList(listId: ListId): Promise<Task | null> {
    const last = [...mockTasks().values()]
      .filter((task) => task.listId === listId)
      .sort(byPositionThenId)
      .at(-1)
    return last ? structuredClone(last) : null
  }

  async findInList(listId: ListId): Promise<Task[]> {
    return [...mockTasks().values()]
      .filter((task) => task.listId === listId)
      .sort(byPositionThenId)
      .map((task) => structuredClone(task))
  }

  async save(
    task: Task,
    events: readonly TaskEvent[],
    origin: EventOrigin
  ): Promise<Result<Task, ConflictError>> {
    const tasks = mockTasks()
    const stored = tasks.get(task.id)
    const fresh =
      task.version === 0 ? !stored : stored?.version === task.version
    if (!fresh) return err(new ConflictError('Task', task.id))

    const saved = { ...task, version: task.version + 1 }
    tasks.set(task.id, structuredClone(saved))
    this.outbox.append(
      outboxEntries({
        aggregateId: task.id,
        aggregateVersion: saved.version,
        origin,
        domainEvents: events,
        integrationEvents: translateTaskEvents(events),
      })
    )
    return ok(saved)
  }
}
