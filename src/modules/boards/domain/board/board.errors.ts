import { DomainError } from '@/shared/kernel/errors/domain-error'

/** The user being added is already a Board member of this board. */
export class AlreadyAMemberError extends DomainError {
  readonly code = 'boards.board.already-a-member'

  constructor() {
    super('User is already a Board member')
  }
}

/** The user named isn't a Board member of this board. */
export class NotAMemberError extends DomainError {
  readonly code = 'boards.board.not-a-member'

  constructor() {
    super('User is not a Board member')
  }
}

/**
 * The Owner tried to leave, or to remove themself. A board always has
 * exactly one Owner, so they must transfer ownership first.
 */
export class OwnerMustTransferFirstError extends DomainError {
  readonly code = 'boards.board.owner-must-transfer-first'

  constructor() {
    super('The Owner must transfer ownership before leaving')
  }
}
