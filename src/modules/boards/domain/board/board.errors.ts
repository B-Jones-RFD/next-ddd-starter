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

/** Another tag on the board already has this name, ignoring case. */
export class TagNameTakenError extends DomainError {
  readonly code = 'boards.board.tag-name-taken'

  constructor() {
    super('Another tag on the board has this name')
  }
}

// #region owner-must-transfer-first
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
// #endregion owner-must-transfer-first

/** The board is archived, so it is read-only until the Owner restores it. */
export class BoardArchivedError extends DomainError {
  readonly code = 'boards.board.archived'

  constructor() {
    super('The board is archived')
  }
}

/** The name typed to confirm archiving the board isn't the board's name. */
export class BoardNameMismatchError extends DomainError {
  readonly code = 'boards.board.name-mismatch'

  constructor() {
    super('The typed name does not match the board name')
  }
}
