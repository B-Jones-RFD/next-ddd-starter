import type { IActivityReader } from '@/modules/audit/application/ports/activity-reader.port'
import type { IAuditLog } from '@/modules/audit/application/ports/audit-log.port'
import type { AuditEntry } from '@/modules/audit/domain/audit-entry/audit-entry'
import { toUserId } from '@/shared/kernel/user-id'

let sequence = 0

/** A UUID v7-shaped id that sorts after every one made before it. */
function nextId(): string {
  sequence += 1
  return `01900000-0000-7000-8000-${String(sequence).padStart(12, '0')}`
}

/**
 * A `task.renamed` entry by `user-ada` on `task-1` of `board-1`, with a
 * fresh id later than any before it, for contract suites.
 */
export function anEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  // Overriding `action` means overriding `details` to match it.
  return {
    id: nextId(),
    occurredAt: new Date('2026-03-01T10:00:00.000Z'),
    actorId: toUserId('user-ada'),
    subject: 'task',
    subjectId: 'task-1',
    boardId: 'board-1',
    taskId: 'task-1',
    action: 'task.renamed',
    details: { from: 'A', to: 'B' },
    causationId: null,
    ...overrides,
  } as AuditEntry
}

/** The Audit log and its reader, on one store. */
export type AuditAdapters = { log: IAuditLog; reader: IActivityReader }

/** The inbox receipt for `entry`, as its handler would give it. */
export function receiptFor(
  entry: AuditEntry,
  handler = 'audit.recordTaskRenamed'
) {
  return { eventId: entry.id, handler }
}
