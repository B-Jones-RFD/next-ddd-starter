import type { MemberRemoved } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.MemberRemoved.v1`: the Owner removed the Member `userId` from a
 * board. The envelope's `actorId` is the Owner.
 */
export type MemberRemovedV1 = IntegrationEvent<
  'boards.MemberRemoved',
  { boardId: string; userId: string }
>

export function toMemberRemovedV1(event: MemberRemoved): MemberRemovedV1 {
  return {
    type: 'boards.MemberRemoved',
    version: 1,
    payload: { boardId: event.payload.boardId, userId: event.payload.userId },
  }
}
