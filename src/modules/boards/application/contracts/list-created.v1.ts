import type { ListCreated } from '@/modules/boards/domain/list/list.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.ListCreated.v1`: a Board member added list `name` to a board. */
export type ListCreatedV1 = IntegrationEvent<
  'boards.ListCreated',
  { listId: string; boardId: string; name: string }
>

export function toListCreatedV1(event: ListCreated): ListCreatedV1 {
  return {
    type: 'boards.ListCreated',
    version: 1,
    payload: {
      listId: event.payload.listId,
      boardId: event.payload.boardId,
      name: event.payload.name,
    },
  }
}
