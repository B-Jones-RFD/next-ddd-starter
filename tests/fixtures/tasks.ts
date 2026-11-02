import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { toListId } from '@/modules/boards/domain/list/list-id'
import type { Task } from '@/modules/boards/domain/task/task'
import type { TaskDescription } from '@/modules/boards/domain/task/task-description'
import { toTaskId } from '@/modules/boards/domain/task/task-id'
import type { TaskTitle } from '@/modules/boards/domain/task/task-title'

let sequence = 0

/**
 * A saved, active task in `list-tasks` on `board-lists` at position `V`, for
 * domain tests and repository contract suites.
 */
export function aTask(overrides: Partial<Task> = {}): Task {
  sequence += 1
  return {
    id: toTaskId(`task-${sequence}`),
    boardId: toBoardId('board-lists'),
    listId: toListId('list-tasks'),
    title: `Task ${sequence}` as TaskTitle,
    description: '' as TaskDescription,
    position: 'V',
    assignees: [],
    archived: false,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    version: 1,
    ...overrides,
  }
}
