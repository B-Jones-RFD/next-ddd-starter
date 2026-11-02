import { DomainError } from '@/shared/kernel/errors/domain-error'

/** The list is archived, so no task can be added to it or moved into it. */
export class ListArchivedError extends DomainError {
  readonly code = 'boards.list.archived'

  constructor() {
    super('The list is archived')
  }
}
