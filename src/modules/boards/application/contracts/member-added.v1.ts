import type { MemberAdded } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.MemberAdded.v1`: the Owner added `userId` to a board as a Member.
 * The envelope's `actorId` is the Owner.
 */
export type MemberAddedV1 = IntegrationEvent<
  'boards.MemberAdded',
  { boardId: string; userId: string }
>

export function toMemberAddedV1(event: MemberAdded): MemberAddedV1 {
  return {
    type: 'boards.MemberAdded',
    version: 1,
    payload: { boardId: event.payload.boardId, userId: event.payload.userId },
  }
}
