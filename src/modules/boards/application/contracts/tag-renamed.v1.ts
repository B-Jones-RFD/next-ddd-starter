import type { TagRenamed } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.TagRenamed.v1`: a tag's name changed `from` → `to`. */
export type TagRenamedV1 = IntegrationEvent<
  'boards.TagRenamed',
  { boardId: string; tagId: string; from: string; to: string }
>

export function toTagRenamedV1(event: TagRenamed): TagRenamedV1 {
  return {
    type: 'boards.TagRenamed',
    version: 1,
    payload: {
      boardId: event.payload.boardId,
      tagId: event.payload.tagId,
      from: event.payload.from,
      to: event.payload.to,
    },
  }
}
