import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { TagId } from '@/modules/boards/domain/board/tag'
import type { TagColor } from '@/modules/boards/domain/board/tag-color'
import type { DomainEvent } from '@/shared/kernel/events'
import type { UserId } from '@/shared/kernel/user-id'

/** A user created a board. Translated to `boards.BoardCreated.v1`. */
export type BoardCreated = DomainEvent<
  'BoardCreated',
  { boardId: BoardId; name: string }
>

/** The Owner renamed a board. Translated to `boards.BoardRenamed.v1`. */
export type BoardRenamed = DomainEvent<
  'BoardRenamed',
  { boardId: BoardId; from: string; to: string }
>

/** The Owner added a user as a Member. Translated to `boards.MemberAdded.v1`. */
export type MemberAdded = DomainEvent<
  'MemberAdded',
  { boardId: BoardId; userId: UserId }
>

/** The Owner removed a Member. Translated to `boards.MemberRemoved.v1`. */
export type MemberRemoved = DomainEvent<
  'MemberRemoved',
  { boardId: BoardId; userId: UserId }
>

/** A Member left the board. Translated to `boards.MemberLeft.v1`. */
export type MemberLeft = DomainEvent<
  'MemberLeft',
  { boardId: BoardId; userId: UserId }
>

/**
 * The Owner made another Board member the Owner, and became a Member.
 * Translated to `boards.OwnershipTransferred.v1`.
 */
export type OwnershipTransferred = DomainEvent<
  'OwnershipTransferred',
  { boardId: BoardId; fromUserId: UserId; toUserId: UserId }
>

/** The Owner archived a board. Translated to `boards.BoardArchived.v1`. */
export type BoardArchived = DomainEvent<'BoardArchived', { boardId: BoardId }>

/** The Owner restored an archived board. Translated to `boards.BoardRestored.v1`. */
export type BoardRestored = DomainEvent<'BoardRestored', { boardId: BoardId }>
/** A Board member defined a tag. Translated to `boards.TagCreated.v1`. */
export type TagCreated = DomainEvent<
  'TagCreated',
  { boardId: BoardId; tagId: TagId; name: string; color: TagColor }
>

/** A Board member renamed a tag. Translated to `boards.TagRenamed.v1`. */
export type TagRenamed = DomainEvent<
  'TagRenamed',
  { boardId: BoardId; tagId: TagId; from: string; to: string }
>

/** A Board member recolored a tag. Translated to `boards.TagRecolored.v1`. */
export type TagRecolored = DomainEvent<
  'TagRecolored',
  { boardId: BoardId; tagId: TagId; from: TagColor; to: TagColor }
>

/**
 * A Board member deleted a tag. Boards' `boards.untagDeletedTag` handler
 * strips it from every task as a Consequence. Translated to
 * `boards.TagDeleted.v1`.
 */
export type TagDeleted = DomainEvent<
  'TagDeleted',
  { boardId: BoardId; tagId: TagId; name: string }
>

export type BoardEvent =
  | BoardCreated
  | BoardRenamed
  | BoardArchived
  | BoardRestored
  | MemberAdded
  | MemberRemoved
  | MemberLeft
  | OwnershipTransferred
  | TagCreated
  | TagRenamed
  | TagRecolored
  | TagDeleted
