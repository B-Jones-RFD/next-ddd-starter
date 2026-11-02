import { toBoardCreatedV1 } from '@/modules/boards/application/contracts/board-created.v1'
import { toBoardRenamedV1 } from '@/modules/boards/application/contracts/board-renamed.v1'
import { toCommentAddedV1 } from '@/modules/boards/application/contracts/comment-added.v1'
import { toListCreatedV1 } from '@/modules/boards/application/contracts/list-created.v1'
import { toListRenamedV1 } from '@/modules/boards/application/contracts/list-renamed.v1'
import { toListReorderedV1 } from '@/modules/boards/application/contracts/list-reordered.v1'
import { toMemberAddedV1 } from '@/modules/boards/application/contracts/member-added.v1'
import { toMemberLeftV1 } from '@/modules/boards/application/contracts/member-left.v1'
import { toMemberRemovedV1 } from '@/modules/boards/application/contracts/member-removed.v1'
import { toOwnershipTransferredV1 } from '@/modules/boards/application/contracts/ownership-transferred.v1'
import { toTaskCreatedV1 } from '@/modules/boards/application/contracts/task-created.v1'
import { toTaskDescriptionChangedV1 } from '@/modules/boards/application/contracts/task-description-changed.v1'
import { toTaskMovedV1 } from '@/modules/boards/application/contracts/task-moved.v1'
import { toTaskRenamedV1 } from '@/modules/boards/application/contracts/task-renamed.v1'
import { toTaskReorderedV1 } from '@/modules/boards/application/contracts/task-reordered.v1'
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
