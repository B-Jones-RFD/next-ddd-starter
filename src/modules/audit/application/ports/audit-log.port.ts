import type { AuditEntry } from '@/modules/audit/domain/audit-entry/audit-entry'
import type { Name } from '@/modules/audit/domain/name/name'

/** Which handler applied which event, for the inbox. */
export type Receipt = {
  readonly eventId: string
  readonly handler: string
}

/**
 * The append-only Audit log (`audit_entries`) and audit's name projections
 * (`audit_names`), written by audit's handlers. Throws `PersistenceError` on
 * an outage.
 */
export interface IAuditLog {
  /**
   * Appends `entry` and applies `names`, with the inbox row for `receipt`,
   * in one transaction. A receipt or an entry id already recorded changes
   * nothing, and a name older than the stored one is ignored.
   */
  record(
    entry: AuditEntry,
    names: readonly Name[],
    receipt: Receipt
  ): Promise<void>
}
