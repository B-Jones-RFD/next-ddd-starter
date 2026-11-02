import type {
  AuditEntryDto,
  SubjectEntryDto,
} from '@/modules/audit/application/dto/activity.dto'
import type { AuditAction } from '@/modules/audit/domain/audit-entry/audit-entry'

/** A keyset page of entries: newest first, by id (UUID v7). */
export type EntryPage = {
  /** Only entries older than the entry with this id; null for the newest. */
  readonly before: string | null
  readonly limit: number
  readonly excluding: readonly AuditAction[]
}

/** Reads the Audit log for views. Throws `PersistenceError` on an outage. */
export interface IActivityReader {
  /** The board a task's entries are about, or null if audit has none for it. */
  boardOfTask(taskId: string): Promise<string | null>
  /**
   * Up to `limit` entries about `taskId`, newest first (by id, UUID v7),
   * older than the entry `before` if given, leaving out `excluding` actions.
   */
  forTask(
    taskId: string,
    page: {
      before: string | null
      limit: number
      excluding: readonly AuditAction[]
    }
  ): Promise<AuditEntryDto[]>
  /**
   * Up to `limit` entries filed under `boardId` (the board, its lists and its
   * tasks), newest first, older than `before` if given, leaving out
   * `excluding` actions.
   */
  forBoard(boardId: string, page: EntryPage): Promise<SubjectEntryDto[]>
  /**
   * Up to `limit` entries about the user `userId` (their sign-ins, sign-outs
   * and account changes), newest first, older than `before` if given.
   */
  forUser(userId: string, page: EntryPage): Promise<SubjectEntryDto[]>
  /** The entries with these ids, in any order. Unknown ids are skipped. */
  byIds(ids: readonly string[]): Promise<AuditEntryDto[]>
  /** Current names for these ids, from the name projections. Unknown ids are skipped. */
  names(ids: readonly string[]): Promise<Record<string, string>>
}
