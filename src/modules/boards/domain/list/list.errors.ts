import { DomainError } from '@/shared/kernel/errors/domain-error'

/**
 * The list is archived, so it is read-only: it can't be renamed or moved, and
 * no task can be added to it, moved into it or restored into it.
 */
export class ListArchivedError extends DomainError {
  readonly code = 'boards.list.archived'

  constructor() {
    super('The list is archived')
  }
}

/**
 * A list can be archived only when none of its tasks are active, so no
 * active task is hidden by surprise.
 */
export class ListHasActiveTasksError extends DomainError {
  readonly code = 'boards.list.has-active-tasks'

  constructor() {
    super('The list still has active tasks')
  }
}
