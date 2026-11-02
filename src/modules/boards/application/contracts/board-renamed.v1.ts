import type { BoardRenamed } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.BoardRenamed.v1`: a board's name changed `from` → `to`. */
export type BoardRenamedV1 = IntegrationEvent<
  'boards.BoardRenamed',
  { boardId: string; from: string; to: string }
>

export function toBoardRenamedV1(event: BoardRenamed): BoardRenamedV1 {
  return {
    type: 'boards.BoardRenamed',
    version: 1,
    payload: {
      boardId: event.payload.boardId,
      from: event.payload.from,
      to: event.payload.to,
    },
  }
}
