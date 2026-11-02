import type { AuditEntryDto } from '@/modules/audit/application/dto/activity.dto'
import type { AuditAction } from '@/modules/audit/domain/audit-entry/audit-entry'

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
  /** The entries with these ids, in any order. Unknown ids are skipped. */
  byIds(ids: readonly string[]): Promise<AuditEntryDto[]>
  /** Current names for these ids, from the name projections. Unknown ids are skipped. */
  names(ids: readonly string[]): Promise<Record<string, string>>
}
