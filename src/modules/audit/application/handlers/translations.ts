import type { AuditEntry } from '@/modules/audit/domain/audit-entry/audit-entry'
import type { Name } from '@/modules/audit/domain/name/name'
import type {
  BoardCreatedV1,
  BoardRenamedV1,
  ListCreatedV1,
  ListRenamedV1,
  ListReorderedV1,
  MemberAddedV1,
  MemberLeftV1,
  MemberRemovedV1,
  OwnershipTransferredV1,
  TagCreatedV1,
  TagDeletedV1,
  TagRecoloredV1,
  TagRenamedV1,
  TaskAssignedV1,
  TaskCreatedV1,
  TaskDescriptionChangedV1,
  TaskMovedV1,
  TaskRenamedV1,
  TaskReorderedV1,
  TaskTaggedV1,
  TaskUntaggedV1,
  TaskUnassignedV1,
} from '@/modules/boards/contracts'
import type {
  UserPasswordChangedV1,
  UserRegisteredV1,
  UserRenamedV1,
  UserSignedInV1,
  UserSignedOutV1,
} from '@/modules/identity/contracts'
import type { EnvelopeOf, EventEnvelope } from '@/shared/kernel/events'

/** Every integration event audit records: all of identity's and boards' v1 events. */
export type AuditedEvent =
  | UserRegisteredV1
  | UserRenamedV1
  | UserPasswordChangedV1
  | UserSignedInV1
  | UserSignedOutV1
  | BoardCreatedV1
  | BoardRenamedV1
  | MemberAddedV1
  | MemberRemovedV1
  | MemberLeftV1
  | OwnershipTransferredV1
  | ListCreatedV1
  | ListRenamedV1
  | ListReorderedV1
  | TaskCreatedV1
  | TaskRenamedV1
  | TaskDescriptionChangedV1
  | TaskMovedV1
  | TaskReorderedV1
  | TagCreatedV1
  | TagRenamedV1
  | TagRecoloredV1
  | TagDeletedV1
  | TaskTaggedV1
  | TaskUntaggedV1
  | TaskAssignedV1
  | TaskUnassignedV1

/** One event in audit's language: its entry, and any current names it tells. */
export type Translation = {
  readonly entry: AuditEntry
  readonly names: readonly Name[]
}

type Translator<E extends AuditedEvent> = (
  envelope: EnvelopeOf<E>
) => Translation

/** The fields every entry takes from its envelope. */
function meta(envelope: EventEnvelope) {
  return {
    id: envelope.id,
    occurredAt: new Date(envelope.occurredAt),
    actorId: envelope.actorId,
    causationId: envelope.causationId,
  }
}

function onUser(
  envelope: EnvelopeOf<{
    type: string
    version: number
    payload: { userId: string }
  }>
) {
  return {
    ...meta(envelope),
    subject: 'user' as const,
    subjectId: envelope.payload.userId,
    boardId: null,
    taskId: null,
  }
}

function onBoard(
  envelope: EnvelopeOf<{
    type: string
    version: number
    payload: { boardId: string }
  }>
) {
  return {
    ...meta(envelope),
    subject: 'board' as const,
    subjectId: envelope.payload.boardId,
    boardId: envelope.payload.boardId,
    taskId: null,
  }
}

function onList(
  envelope: EnvelopeOf<{
    type: string
    version: number
    payload: { boardId: string; listId: string }
  }>
) {
  return {
    ...meta(envelope),
    subject: 'list' as const,
    subjectId: envelope.payload.listId,
    boardId: envelope.payload.boardId,
    taskId: null,
  }
}

function onTask(
  envelope: EnvelopeOf<{
    type: string
    version: number
    payload: { boardId: string; taskId: string }
  }>
) {
  return {
    ...meta(envelope),
    subject: 'task' as const,
    subjectId: envelope.payload.taskId,
    boardId: envelope.payload.boardId,
    taskId: envelope.payload.taskId,
  }
}

function name(
  kind: Name['kind'],
  id: string,
  value: string,
  envelope: EventEnvelope
): Name {
  return { kind, id, name: value, aggregateVersion: envelope.aggregateVersion }
}

// #region translations
/**
 * How each event contract becomes an Audit entry (ADR 0010). A new contract
 * adds its translator here, and a v2 contract changes only its translator:
 * stored entries never change.
 */
export const TRANSLATIONS: { [E in AuditedEvent as E['type']]: Translator<E> } =
  {
    'identity.UserRegistered': (e) => ({
      entry: {
        ...onUser(e),
        action: 'user.registered',
        details: { displayName: e.payload.displayName },
      },
      names: [name('person', e.payload.userId, e.payload.displayName, e)],
    }),
    'identity.UserRenamed': (e) => ({
      entry: {
        ...onUser(e),
        action: 'user.renamed',
        details: { from: e.payload.from, to: e.payload.to },
      },
      names: [name('person', e.payload.userId, e.payload.to, e)],
    }),
    'identity.UserPasswordChanged': (e) => ({
      entry: { ...onUser(e), action: 'user.password-changed', details: {} },
      names: [],
    }),
    'identity.UserSignedIn': (e) => ({
      entry: { ...onUser(e), action: 'user.signed-in', details: {} },
      names: [],
    }),
    'identity.UserSignedOut': (e) => ({
      entry: {
        ...onUser(e),
        action: 'user.signed-out',
        details: { everywhere: e.payload.everywhere },
      },
      names: [],
    }),
    'boards.BoardCreated': (e) => ({
      entry: {
        ...onBoard(e),
        action: 'board.created',
        details: { name: e.payload.name },
      },
      names: [name('board', e.payload.boardId, e.payload.name, e)],
    }),
    'boards.BoardRenamed': (e) => ({
      entry: {
        ...onBoard(e),
        action: 'board.renamed',
        details: { from: e.payload.from, to: e.payload.to },
      },
      names: [name('board', e.payload.boardId, e.payload.to, e)],
    }),
    'boards.MemberAdded': (e) => ({
      entry: {
        ...onBoard(e),
        action: 'member.added',
        details: { userId: e.payload.userId },
      },
      names: [],
    }),
    'boards.MemberRemoved': (e) => ({
      entry: {
        ...onBoard(e),
        action: 'member.removed',
        details: { userId: e.payload.userId },
      },
      names: [],
    }),
    'boards.MemberLeft': (e) => ({
      entry: {
        ...onBoard(e),
        action: 'member.left',
        details: { userId: e.payload.userId },
      },
      names: [],
    }),
    'boards.OwnershipTransferred': (e) => ({
      entry: {
        ...onBoard(e),
        action: 'ownership.transferred',
        details: {
          fromUserId: e.payload.fromUserId,
          toUserId: e.payload.toUserId,
        },
      },
      names: [],
    }),
    'boards.ListCreated': (e) => ({
      entry: {
        ...onList(e),
        action: 'list.created',
        details: { name: e.payload.name },
      },
      names: [name('list', e.payload.listId, e.payload.name, e)],
    }),
    'boards.ListRenamed': (e) => ({
      entry: {
        ...onList(e),
        action: 'list.renamed',
        details: { from: e.payload.from, to: e.payload.to },
      },
      names: [name('list', e.payload.listId, e.payload.to, e)],
    }),
    'boards.ListReordered': (e) => ({
      entry: { ...onList(e), action: 'list.reordered', details: {} },
      names: [],
    }),
    'boards.TaskCreated': (e) => ({
      entry: {
        ...onTask(e),
        action: 'task.created',
        details: { listId: e.payload.listId, title: e.payload.title },
      },
      names: [name('task', e.payload.taskId, e.payload.title, e)],
    }),
    'boards.TaskRenamed': (e) => ({
      entry: {
        ...onTask(e),
        action: 'task.renamed',
        details: { from: e.payload.from, to: e.payload.to },
      },
      names: [name('task', e.payload.taskId, e.payload.to, e)],
    }),
    'boards.TaskDescriptionChanged': (e) => ({
      entry: {
        ...onTask(e),
        action: 'task.description-changed',
        details: { from: e.payload.from, to: e.payload.to },
      },
      names: [],
    }),
    'boards.TaskMoved': (e) => ({
      entry: {
        ...onTask(e),
        action: 'task.moved',
        details: {
          fromListId: e.payload.fromListId,
          toListId: e.payload.toListId,
        },
      },
      names: [],
    }),
    'boards.TaskReordered': (e) => ({
      entry: {
        ...onTask(e),
        action: 'task.reordered',
        details: { listId: e.payload.listId },
      },
      names: [],
    }),
    'boards.TagCreated': (e) => ({
      entry: {
        ...onBoard(e),
        action: 'tag.created',
        details: {
          tagId: e.payload.tagId,
          name: e.payload.name,
          color: e.payload.color,
        },
      },
      names: [name('tag', e.payload.tagId, e.payload.name, e)],
    }),
    'boards.TagRenamed': (e) => ({
      entry: {
        ...onBoard(e),
        action: 'tag.renamed',
        details: {
          tagId: e.payload.tagId,
          from: e.payload.from,
          to: e.payload.to,
        },
      },
      names: [name('tag', e.payload.tagId, e.payload.to, e)],
    }),
    'boards.TagRecolored': (e) => ({
      entry: {
        ...onBoard(e),
        action: 'tag.recolored',
        details: {
          tagId: e.payload.tagId,
          from: e.payload.from,
          to: e.payload.to,
        },
      },
      names: [],
    }),
    'boards.TagDeleted': (e) => ({
      entry: {
        ...onBoard(e),
        action: 'tag.deleted',
        details: { tagId: e.payload.tagId, name: e.payload.name },
      },
      names: [],
    }),
    'boards.TaskTagged': (e) => ({
      entry: {
        ...onTask(e),
        action: 'task.tagged',
        details: { tagId: e.payload.tagId },
      },
      names: [],
    }),
    'boards.TaskUntagged': (e) => ({
      entry: {
        ...onTask(e),
        action: 'task.untagged',
        details: { tagId: e.payload.tagId },
      },
      names: [],
    }),
    // A hand-over to the Owner is a Consequence: its causationId names the
    // removal or leaving.
    'boards.TaskAssigned': (e) => ({
      entry: {
        ...onTask(e),
        action: 'task.assigned',
        details: { userId: e.payload.userId },
      },
      names: [],
    }),
    'boards.TaskUnassigned': (e) => ({
      entry: {
        ...onTask(e),
        action: 'task.unassigned',
        details: { userId: e.payload.userId },
      },
      names: [],
    }),
  }
// #endregion translations

export type AuditedEventType = keyof typeof TRANSLATIONS

/**
 * Translates `envelope`, an event of one of the audited contracts. The relay
 * routes each handler only its own type, so any other type is a bug.
 */
export function translate(envelope: EventEnvelope): Translation {
  if (!(envelope.type in TRANSLATIONS)) {
    throw new Error(`Audit has no translation for ${envelope.type}.`)
  }
  const translator = TRANSLATIONS[envelope.type as AuditedEventType] as (
    envelope: EventEnvelope
  ) => Translation
  return translator(envelope)
}
