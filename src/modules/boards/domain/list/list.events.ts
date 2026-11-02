import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import type { DomainEvent } from '@/shared/kernel/events'

/** A Board member created a list. Translated to `boards.ListCreated.v1`. */
export type ListCreated = DomainEvent<
  'ListCreated',
  { listId: ListId; boardId: BoardId; name: string }
>

/** A Board member renamed a list. Translated to `boards.ListRenamed.v1`. */
export type ListRenamed = DomainEvent<
  'ListRenamed',
  { listId: ListId; boardId: BoardId; from: string; to: string }
>

/**
 * A Board member moved a list to another place in its board's order.
 * Positions are opaque keys, so the event carries no `from` or `to`.
 * Translated to `boards.ListReordered.v1`.
 */
export type ListReordered = DomainEvent<
  'ListReordered',
  { listId: ListId; boardId: BoardId }
>

/** A Board member archived a list. Translated to `boards.ListArchived.v1`. */
export type ListArchived = DomainEvent<
  'ListArchived',
  { listId: ListId; boardId: BoardId }
>

/** A Board member restored an archived list. Translated to `boards.ListRestored.v1`. */
export type ListRestored = DomainEvent<
  'ListRestored',
  { listId: ListId; boardId: BoardId }
>

export type ListEvent =
  ListCreated | ListRenamed | ListReordered | ListArchived | ListRestored
