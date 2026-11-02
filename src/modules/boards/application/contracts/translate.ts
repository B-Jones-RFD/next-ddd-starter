import { toBoardCreatedV1 } from '@/modules/boards/application/contracts/board-created.v1'
import { toBoardRenamedV1 } from '@/modules/boards/application/contracts/board-renamed.v1'
import { toListCreatedV1 } from '@/modules/boards/application/contracts/list-created.v1'
import { toListRenamedV1 } from '@/modules/boards/application/contracts/list-renamed.v1'
import { toListReorderedV1 } from '@/modules/boards/application/contracts/list-reordered.v1'
import type { BoardEvent } from '@/modules/boards/domain/board/board.events'
import type { ListEvent } from '@/modules/boards/domain/list/list.events'
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

/** The published translations of a list's domain events (§6). */
export function translateListEvents(
  events: readonly ListEvent[]
): IntegrationEvent[] {
  return events.map((event) => {
    switch (event.type) {
      case 'ListCreated':
        return toListCreatedV1(event)
      case 'ListRenamed':
        return toListRenamedV1(event)
      case 'ListReordered':
        return toListReorderedV1(event)
    }
  })
}
