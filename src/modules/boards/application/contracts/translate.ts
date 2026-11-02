import { toBoardCreatedV1 } from '@/modules/boards/application/contracts/board-created.v1'
import { toBoardRenamedV1 } from '@/modules/boards/application/contracts/board-renamed.v1'
import { toMemberAddedV1 } from '@/modules/boards/application/contracts/member-added.v1'
import { toMemberLeftV1 } from '@/modules/boards/application/contracts/member-left.v1'
import { toMemberRemovedV1 } from '@/modules/boards/application/contracts/member-removed.v1'
import { toOwnershipTransferredV1 } from '@/modules/boards/application/contracts/ownership-transferred.v1'
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
      case 'MemberAdded':
        return toMemberAddedV1(event)
      case 'MemberRemoved':
        return toMemberRemovedV1(event)
      case 'MemberLeft':
        return toMemberLeftV1(event)
      case 'OwnershipTransferred':
        return toOwnershipTransferredV1(event)
    }
  })
}
