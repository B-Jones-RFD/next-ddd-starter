import { toBoardCreatedV1 } from '@/modules/boards/application/contracts/board-created.v1'
import { toBoardRenamedV1 } from '@/modules/boards/application/contracts/board-renamed.v1'
import type { BoardEvent } from '@/modules/boards/domain/board/board.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** The published translations of a board's domain events (§6). */
export function translateBoardEvents(
  events: readonly BoardEvent[]
): IntegrationEvent[] {
  return events.map((event) => {
    switch (event.type) {
      case 'BoardCreated':
        return toBoardCreatedV1(event)
      case 'BoardRenamed':
        return toBoardRenamedV1(event)
    }
  })
}
