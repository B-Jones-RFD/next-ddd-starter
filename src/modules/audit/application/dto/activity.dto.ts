import type { AuditEntry } from '@/modules/audit/domain/audit-entry/audit-entry'

type EntryDto<E extends AuditEntry> = E extends AuditEntry
  ? {
      id: string
      /** ISO 8601. */
      occurredAt: string
      actorId: string
      action: E['action']
      details: E['details']
      /** The id of the entry that caused this one, for a Consequence. */
      causationId: string | null
    }
  : never

/** One Audit entry as a view shows it, keyed by `action`. */
export type AuditEntryDto = EntryDto<AuditEntry>

/** An entry in a task's Activity, with the entry that caused it, if any. */
export type ActivityEntryDto = AuditEntryDto & {
  cause: AuditEntryDto | null
}

/** One page of a task's Activity, newest first. */
export type ActivityPageDto = {
  entries: ActivityEntryDto[]
  /** Current names of the people, lists and tags the entries name, by id. */
  names: Record<string, string>
  /** Pass as `before` for the next, older page; null on the last page. */
  olderBefore: string | null
}
