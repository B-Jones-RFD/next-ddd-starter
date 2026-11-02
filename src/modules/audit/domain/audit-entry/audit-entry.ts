import type { UserId } from '@/shared/kernel/user-id'

/** What an Audit entry is about. */
export type Subject = 'user' | 'board' | 'list' | 'task'

type Entry<
  S extends Subject,
  Action extends string,
  Details extends Record<string, unknown>,
> = {
  /** The id of the integration event it records, so a redelivery is a no-op. */
  readonly id: string
  readonly occurredAt: Date
  /** Who did it, or who started the chain for a Consequence. */
  readonly actorId: UserId
  readonly subject: S
  readonly subjectId: string
  readonly boardId: string | null
  readonly taskId: string | null
  readonly action: Action
  readonly details: Readonly<Details>
  /** The entry for the change that caused this one, for a Consequence. */
  readonly causationId: string | null
}

type Change = { from: string; to: string }
type NoDetails = Record<never, never>

// #region audit-entry
/**
 * One record in the Audit log, in audit's own language (ADR 0010), keyed by
 * `action`. Ids in `details` name people, lists and tags; their current names
 * come from audit's name projections.
 */
export type AuditEntry =
  | Entry<'user', 'user.registered', { displayName: string }>
  | Entry<'user', 'user.renamed', Change>
  | Entry<'user', 'user.password-changed', NoDetails>
  | Entry<'user', 'user.signed-in', NoDetails>
  | Entry<'user', 'user.signed-out', { everywhere: boolean }>
  | Entry<'board', 'board.created', { name: string }>
  | Entry<'board', 'board.renamed', Change>
  | Entry<'board', 'board.archived', NoDetails>
  | Entry<'board', 'board.restored', NoDetails>
  | Entry<'board', 'member.added', { userId: string }>
  | Entry<'board', 'member.removed', { userId: string }>
  | Entry<'board', 'member.left', { userId: string }>
  | Entry<
      'board',
      'ownership.transferred',
      { fromUserId: string; toUserId: string }
    >
  | Entry<'list', 'list.created', { name: string }>
  | Entry<'list', 'list.renamed', Change>
  | Entry<'list', 'list.reordered', NoDetails>
  | Entry<'list', 'list.archived', NoDetails>
  | Entry<'list', 'list.restored', NoDetails>
  | Entry<'task', 'task.created', { listId: string; title: string }>
  | Entry<'task', 'task.renamed', Change>
  | Entry<'task', 'task.description-changed', Change>
  | Entry<'task', 'task.moved', { fromListId: string; toListId: string }>
  | Entry<'task', 'task.reordered', { listId: string }>
  | Entry<'task', 'task.archived', { listId: string }>
  | Entry<'task', 'task.restored', { listId: string }>
  | Entry<'task', 'comment.added', { commentId: string; text: string }>
  | Entry<
      'board',
      'tag.created',
      { tagId: string; name: string; color: string }
    >
  | Entry<'board', 'tag.renamed', Change & { tagId: string }>
  | Entry<'board', 'tag.recolored', Change & { tagId: string }>
  | Entry<'board', 'tag.deleted', { tagId: string; name: string }>
  | Entry<'task', 'task.tagged', { tagId: string }>
  | Entry<'task', 'task.untagged', { tagId: string }>
  | Entry<'task', 'task.assigned', { userId: string }>
  | Entry<'task', 'task.unassigned', { userId: string }>
// #endregion audit-entry

export type AuditAction = AuditEntry['action']

/** The entry for `action`. */
export type EntryFor<A extends AuditAction> = Extract<AuditEntry, { action: A }>

/**
 * Reorders, which views hide by default: positions are opaque keys, so these
 * entries say only that something moved (ADR 0010).
 */
export const REORDER_ACTIONS = [
  'list.reordered',
  'task.reordered',
] as const satisfies readonly AuditAction[]

const ID_FIELDS = [
  'userId',
  'fromUserId',
  'toUserId',
  'listId',
  'fromListId',
  'toListId',
  'tagId',
] as const

/**
 * Every id an entry names whose current name a view shows: its actor and
 * the people, lists and tags in its details.
 */
export function namedIds(entry: {
  readonly actorId: string
  readonly details: object
}): string[] {
  const details = entry.details as Readonly<Record<string, unknown>>
  const ids: string[] = [entry.actorId]
  for (const field of ID_FIELDS) {
    const value = details[field]
    if (typeof value === 'string' && !ids.includes(value)) ids.push(value)
  }
  return ids
}
