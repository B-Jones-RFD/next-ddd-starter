import type { AuditEntryDto } from '@/modules/audit/api'

/** Current names by id, as an Activity page gives them. */
export type Names = Readonly<Record<string, string>>

/** The name of the person `userId`, or a stand-in if audit hasn't heard it. */
export function personName(names: Names, userId: string): string {
  return names[userId] ?? 'Someone'
}

function listName(names: Names, listId: string): string {
  const name = names[listId]
  return name ? `“${name}”` : 'a list'
}

function tagName(names: Names, tagId: string): string {
  const name = names[tagId]
  return name ? `“${name}”` : 'a deleted tag'
}

// #region wording
/**
 * What an Audit entry says its actor did, after the actor's name: audit's
 * wording for each `action`, in the glossary's terms (§7: all user-facing
 * text lives in `app/`). Ids read as their current names.
 */
export function entryWording(entry: AuditEntryDto, names: Names): string {
  switch (entry.action) {
    case 'user.registered':
      return `signed up as “${entry.details.displayName}”`
    case 'user.renamed':
      return `changed their name from “${entry.details.from}” to “${entry.details.to}”`
    case 'user.password-changed':
      return 'changed their password'
    case 'user.signed-in':
      return 'signed in'
    case 'user.signed-out':
      return entry.details.everywhere ? 'signed out everywhere' : 'signed out'
    case 'board.created':
      return `created the board “${entry.details.name}”`
    case 'board.renamed':
      return `renamed the board from “${entry.details.from}” to “${entry.details.to}”`
    case 'board.archived':
      return 'archived the board'
    case 'board.restored':
      return 'restored the board'
    case 'member.added':
      return `added ${personName(names, entry.details.userId)} to the board`
    case 'member.removed':
      return `removed ${personName(names, entry.details.userId)} from the board`
    case 'member.left':
      return 'left the board'
    case 'ownership.transferred':
      return `made ${personName(names, entry.details.toUserId)} the Owner`
    case 'list.created':
      return `added the list “${entry.details.name}”`
    case 'list.renamed':
      return `renamed the list from “${entry.details.from}” to “${entry.details.to}”`
    case 'list.reordered':
      return 'reordered the lists'
    case 'list.archived':
      return 'archived a list'
    case 'list.restored':
      return 'restored a list'
    case 'task.created':
      return `created the task in ${listName(names, entry.details.listId)}`
    case 'task.renamed':
      return `renamed the task from “${entry.details.from}” to “${entry.details.to}”`
    case 'task.description-changed':
      return 'changed the description'
    case 'task.moved':
      return `moved the task from ${listName(names, entry.details.fromListId)} to ${listName(names, entry.details.toListId)}`
    case 'task.reordered':
      return `reordered the task in ${listName(names, entry.details.listId)}`
    case 'task.archived':
      return 'archived the task'
    case 'task.restored':
      return `restored the task to ${listName(names, entry.details.listId)}`
    case 'comment.added':
      return 'commented'
    case 'tag.created':
      return `created the tag “${entry.details.name}”`
    case 'tag.renamed':
      return `renamed the tag from “${entry.details.from}” to “${entry.details.to}”`
    case 'tag.recolored':
      return `changed the tag ${tagName(names, entry.details.tagId)} from ${entry.details.from} to ${entry.details.to}`
    case 'tag.deleted':
      return `deleted the tag “${entry.details.name}”`
    case 'task.tagged':
      return `added the tag ${tagName(names, entry.details.tagId)}`
    case 'task.untagged':
      return `removed the tag ${tagName(names, entry.details.tagId)}`
    case 'task.assigned':
      return `assigned ${personName(names, entry.details.userId)}`
    case 'task.unassigned':
      return `unassigned ${personName(names, entry.details.userId)}`
  }
}
// #endregion wording

/** The whole sentence for an entry: its actor's name, then the wording. */
export function entrySentence(entry: AuditEntryDto, names: Names): string {
  return `${personName(names, entry.actorId)} ${entryWording(entry, names)}`
}
