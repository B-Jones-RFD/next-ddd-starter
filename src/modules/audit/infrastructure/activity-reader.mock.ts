import type { AuditEntryDto } from '@/modules/audit/application/dto/activity.dto'
import type { IActivityReader } from '@/modules/audit/application/ports/activity-reader.port'
import type {
  AuditAction,
  AuditEntry,
} from '@/modules/audit/domain/audit-entry/audit-entry'
import { mockAudit } from '@/modules/audit/infrastructure/audit-log.mock'

function toDto(entry: AuditEntry): AuditEntryDto {
  return {
    id: entry.id,
    occurredAt: entry.occurredAt.toISOString(),
    actorId: entry.actorId,
    action: entry.action,
    details: structuredClone(entry.details),
    causationId: entry.causationId,
  } as AuditEntryDto
}

/** Newest first: ids are UUID v7, so they sort by time. */
function newestFirst(a: AuditEntry, b: AuditEntry): number {
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

/** In-memory twin of `ActivityReader`, reading the mock Audit log. */
export class MockActivityReader implements IActivityReader {
  async boardOfTask(taskId: string): Promise<string | null> {
    for (const entry of mockAudit().entries.values()) {
      if (entry.taskId === taskId) return entry.boardId
    }
    return null
  }

  async forTask(
    taskId: string,
    page: {
      before: string | null
      limit: number
      excluding: readonly AuditAction[]
    }
  ): Promise<AuditEntryDto[]> {
    return [...mockAudit().entries.values()]
      .filter(
        (entry) =>
          entry.taskId === taskId &&
          !page.excluding.includes(entry.action) &&
          (page.before === null || entry.id < page.before)
      )
      .sort(newestFirst)
      .slice(0, page.limit)
      .map(toDto)
  }

  async byIds(ids: readonly string[]): Promise<AuditEntryDto[]> {
    const { entries } = mockAudit()
    return ids.flatMap((id) => {
      const entry = entries.get(id)
      return entry ? [toDto(entry)] : []
    })
  }

  async names(ids: readonly string[]): Promise<Record<string, string>> {
    const wanted = new Set(ids)
    const found: Record<string, string> = {}
    for (const [key, { name }] of mockAudit().names) {
      const id = key.slice(key.indexOf('|') + 1)
      if (wanted.has(id)) found[id] = name
    }
    return found
  }
}
