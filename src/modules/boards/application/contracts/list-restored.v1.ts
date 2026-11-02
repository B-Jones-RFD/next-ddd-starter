import type { ListRestored } from '@/modules/boards/domain/list/list.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.ListRestored.v1`: an archived list was restored to its old place. */
export type ListRestoredV1 = IntegrationEvent<
  'boards.ListRestored',
  { listId: string; boardId: string }
>

export function toListRestoredV1(event: ListRestored): ListRestoredV1 {
  return {
    type: 'boards.ListRestored',
    version: 1,
    payload: {
      listId: event.payload.listId,
      boardId: event.payload.boardId,
    },
  }
}
