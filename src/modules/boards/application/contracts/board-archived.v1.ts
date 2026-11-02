import type { BoardArchived } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.BoardArchived.v1`: the Owner archived a board. Its lists and tasks are unchanged. */
export type BoardArchivedV1 = IntegrationEvent<
  'boards.BoardArchived',
  { boardId: string }
>

export function toBoardArchivedV1(event: BoardArchived): BoardArchivedV1 {
  return {
    type: 'boards.BoardArchived',
    version: 1,
    payload: {
      boardId: event.payload.boardId,
    },
  }
}
