import type { BoardRestored } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.BoardRestored.v1`: the Owner restored an archived board. */
export type BoardRestoredV1 = IntegrationEvent<
  'boards.BoardRestored',
  { boardId: string }
>

export function toBoardRestoredV1(event: BoardRestored): BoardRestoredV1 {
  return {
    type: 'boards.BoardRestored',
    version: 1,
    payload: {
      boardId: event.payload.boardId,
    },
  }
}
