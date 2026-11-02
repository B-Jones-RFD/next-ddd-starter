import type { OwnershipTransferred } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.OwnershipTransferred.v1`: a board's Owner changed `fromUserId` →
 * `toUserId`. The former Owner is now a Member.
 */
export type OwnershipTransferredV1 = IntegrationEvent<
  'boards.OwnershipTransferred',
  { boardId: string; fromUserId: string; toUserId: string }
>

export function toOwnershipTransferredV1(
  event: OwnershipTransferred
): OwnershipTransferredV1 {
  return {
    type: 'boards.OwnershipTransferred',
    version: 1,
    payload: {
      boardId: event.payload.boardId,
      fromUserId: event.payload.fromUserId,
      toUserId: event.payload.toUserId,
    },
  }
}
