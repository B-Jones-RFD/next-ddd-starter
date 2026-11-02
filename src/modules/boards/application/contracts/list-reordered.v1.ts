import type { ListReordered } from '@/modules/boards/domain/list/list.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.ListReordered.v1`: a list moved to another place in its board's
 * order. Positions are opaque keys, so there is no `from` or `to`.
 */
export type ListReorderedV1 = IntegrationEvent<
  'boards.ListReordered',
  { listId: string; boardId: string }
>

export function toListReorderedV1(event: ListReordered): ListReorderedV1 {
  return {
    type: 'boards.ListReordered',
    version: 1,
    payload: {
      listId: event.payload.listId,
      boardId: event.payload.boardId,
    },
  }
}
