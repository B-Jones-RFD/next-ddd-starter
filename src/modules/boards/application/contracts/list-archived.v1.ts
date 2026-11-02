import type { ListArchived } from '@/modules/boards/domain/list/list.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.ListArchived.v1`: a list was archived, keeping its place. */
export type ListArchivedV1 = IntegrationEvent<
  'boards.ListArchived',
  { listId: string; boardId: string }
>

export function toListArchivedV1(event: ListArchived): ListArchivedV1 {
  return {
    type: 'boards.ListArchived',
    version: 1,
    payload: {
      listId: event.payload.listId,
      boardId: event.payload.boardId,
    },
  }
}
