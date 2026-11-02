import type { TagRecolored } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.TagRecolored.v1`: a tag's Tag color changed `from` → `to`. */
export type TagRecoloredV1 = IntegrationEvent<
  'boards.TagRecolored',
  { boardId: string; tagId: string; from: string; to: string }
>

export function toTagRecoloredV1(event: TagRecolored): TagRecoloredV1 {
  return {
    type: 'boards.TagRecolored',
    version: 1,
    payload: {
      boardId: event.payload.boardId,
      tagId: event.payload.tagId,
      from: event.payload.from,
      to: event.payload.to,
    },
  }
}
