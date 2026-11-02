import type { MemberLeft } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.MemberLeft.v1`: the Member `userId` left a board. */
export type MemberLeftV1 = IntegrationEvent<
  'boards.MemberLeft',
  { boardId: string; userId: string }
>

export function toMemberLeftV1(event: MemberLeft): MemberLeftV1 {
  return {
    type: 'boards.MemberLeft',
    version: 1,
    payload: { boardId: event.payload.boardId, userId: event.payload.userId },
  }
}
