import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { DomainEvent } from '@/shared/kernel/events'

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

export type BoardEvent = BoardCreated | BoardRenamed
