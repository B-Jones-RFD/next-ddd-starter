import type { ListRenamed } from '@/modules/boards/domain/list/list.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.ListRenamed.v1`: a list's name changed `from` → `to`. */
export type ListRenamedV1 = IntegrationEvent<
  'boards.ListRenamed',
  { listId: string; boardId: string; from: string; to: string }
>

export function toListRenamedV1(event: ListRenamed): ListRenamedV1 {
  return {
    type: 'boards.ListRenamed',
    version: 1,
    payload: {
      listId: event.payload.listId,
      boardId: event.payload.boardId,
      from: event.payload.from,
      to: event.payload.to,
    },
  }
}
