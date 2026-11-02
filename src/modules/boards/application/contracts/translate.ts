import { toBoardArchivedV1 } from '@/modules/boards/application/contracts/board-archived.v1'
import { toBoardCreatedV1 } from '@/modules/boards/application/contracts/board-created.v1'
import { toBoardRenamedV1 } from '@/modules/boards/application/contracts/board-renamed.v1'
import { toBoardRestoredV1 } from '@/modules/boards/application/contracts/board-restored.v1'
import { toListArchivedV1 } from '@/modules/boards/application/contracts/list-archived.v1'
import { toCommentAddedV1 } from '@/modules/boards/application/contracts/comment-added.v1'
import { toListCreatedV1 } from '@/modules/boards/application/contracts/list-created.v1'
import { toListRenamedV1 } from '@/modules/boards/application/contracts/list-renamed.v1'
import { toListReorderedV1 } from '@/modules/boards/application/contracts/list-reordered.v1'
import { toListRestoredV1 } from '@/modules/boards/application/contracts/list-restored.v1'
import { toMemberAddedV1 } from '@/modules/boards/application/contracts/member-added.v1'
import { toMemberLeftV1 } from '@/modules/boards/application/contracts/member-left.v1'
import { toMemberRemovedV1 } from '@/modules/boards/application/contracts/member-removed.v1'
import { toOwnershipTransferredV1 } from '@/modules/boards/application/contracts/ownership-transferred.v1'
import { toTaskArchivedV1 } from '@/modules/boards/application/contracts/task-archived.v1'
import { toTagCreatedV1 } from '@/modules/boards/application/contracts/tag-created.v1'
import { toTagDeletedV1 } from '@/modules/boards/application/contracts/tag-deleted.v1'
import { toTagRecoloredV1 } from '@/modules/boards/application/contracts/tag-recolored.v1'
import { toTagRenamedV1 } from '@/modules/boards/application/contracts/tag-renamed.v1'
import { toTaskAssignedV1 } from '@/modules/boards/application/contracts/task-assigned.v1'
import { toTaskCreatedV1 } from '@/modules/boards/application/contracts/task-created.v1'
import { toTaskDescriptionChangedV1 } from '@/modules/boards/application/contracts/task-description-changed.v1'
import { toTaskMovedV1 } from '@/modules/boards/application/contracts/task-moved.v1'
import { toTaskRenamedV1 } from '@/modules/boards/application/contracts/task-renamed.v1'
import { toTaskReorderedV1 } from '@/modules/boards/application/contracts/task-reordered.v1'
import { toTaskRestoredV1 } from '@/modules/boards/application/contracts/task-restored.v1'
import { toTaskTaggedV1 } from '@/modules/boards/application/contracts/task-tagged.v1'
import { toTaskUntaggedV1 } from '@/modules/boards/application/contracts/task-untagged.v1'
import { toTaskUnassignedV1 } from '@/modules/boards/application/contracts/task-unassigned.v1'
import type { BoardEvent } from '@/modules/boards/domain/board/board.events'
import type { CommentEvent } from '@/modules/boards/domain/comment/comment.events'
import type { ListEvent } from '@/modules/boards/domain/list/list.events'
import type { TaskEvent } from '@/modules/boards/domain/task/task.events'
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
      case 'BoardArchived':
        return toBoardArchivedV1(event)
      case 'BoardRestored':
        return toBoardRestoredV1(event)
      case 'MemberAdded':
        return toMemberAddedV1(event)
      case 'MemberRemoved':
        return toMemberRemovedV1(event)
      case 'MemberLeft':
        return toMemberLeftV1(event)
      case 'OwnershipTransferred':
        return toOwnershipTransferredV1(event)
      case 'TagCreated':
        return toTagCreatedV1(event)
      case 'TagRenamed':
        return toTagRenamedV1(event)
      case 'TagRecolored':
        return toTagRecoloredV1(event)
      case 'TagDeleted':
        return toTagDeletedV1(event)
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
      case 'ListArchived':
        return toListArchivedV1(event)
      case 'ListRestored':
        return toListRestoredV1(event)
    }
  })
}

/** The published translations of a task's domain events (§6). */
export function translateTaskEvents(
  events: readonly TaskEvent[]
): IntegrationEvent[] {
  return events.map((event) => {
    switch (event.type) {
      case 'TaskCreated':
        return toTaskCreatedV1(event)
      case 'TaskRenamed':
        return toTaskRenamedV1(event)
      case 'TaskDescriptionChanged':
        return toTaskDescriptionChangedV1(event)
      case 'TaskMoved':
        return toTaskMovedV1(event)
      case 'TaskReordered':
        return toTaskReorderedV1(event)
      case 'TaskArchived':
        return toTaskArchivedV1(event)
      case 'TaskRestored':
        return toTaskRestoredV1(event)
      case 'TaskTagged':
        return toTaskTaggedV1(event)
      case 'TaskUntagged':
        return toTaskUntaggedV1(event)
      case 'TaskAssigned':
        return toTaskAssignedV1(event)
      case 'TaskUnassigned':
        return toTaskUnassignedV1(event)
    }
  })
}

/** The published translations of a comment's domain events (§6). */
export function translateCommentEvents(
  events: readonly CommentEvent[]
): IntegrationEvent[] {
  return events.map((event) => {
    switch (event.type) {
      case 'CommentAdded':
        return toCommentAddedV1(event)
    }
  })
}
