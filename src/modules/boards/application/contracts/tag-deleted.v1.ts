import type { TagDeleted } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.TagDeleted.v1`: a Board member deleted a tag. Each task that had
 * it publishes `boards.TaskUntagged.v1` afterwards, caused by this event.
 */
export type TagDeletedV1 = IntegrationEvent<
  'boards.TagDeleted',
  { boardId: string; tagId: string; name: string }
>

export function toTagDeletedV1(event: TagDeleted): TagDeletedV1 {
  return {
    type: 'boards.TagDeleted',
    version: 1,
    payload: {
      boardId: event.payload.boardId,
      tagId: event.payload.tagId,
      name: event.payload.name,
    },
  }
}
