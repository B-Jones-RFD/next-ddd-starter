import type { TagCreated } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.TagCreated.v1`: a Board member defined a tag on a board. */
export type TagCreatedV1 = IntegrationEvent<
  'boards.TagCreated',
  { boardId: string; tagId: string; name: string; color: string }
>

export function toTagCreatedV1(event: TagCreated): TagCreatedV1 {
  return {
    type: 'boards.TagCreated',
    version: 1,
    payload: {
      boardId: event.payload.boardId,
      tagId: event.payload.tagId,
      name: event.payload.name,
      color: event.payload.color,
    },
  }
}
