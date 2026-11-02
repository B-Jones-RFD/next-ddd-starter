import { DomainError } from '@/shared/kernel/errors/domain-error'

/** The task is archived, so it is read-only: nothing can be added to it. */
export class TaskArchivedError extends DomainError {
  readonly code = 'boards.task.archived'

  constructor() {
    super('The task is archived')
  }
}
