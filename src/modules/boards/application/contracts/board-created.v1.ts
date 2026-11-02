import type { BoardCreated } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.BoardCreated.v1`: a user created a board named `name`. The
 * envelope's `actorId` is its first Owner.
 */
export type BoardCreatedV1 = IntegrationEvent<
  'boards.BoardCreated',
  { boardId: string; name: string }
>

export function toBoardCreatedV1(event: BoardCreated): BoardCreatedV1 {
  return {
    type: 'boards.BoardCreated',
    version: 1,
    payload: { boardId: event.payload.boardId, name: event.payload.name },
  }
}
