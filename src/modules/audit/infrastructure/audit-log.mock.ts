import type {
  IAuditLog,
  Receipt,
} from '@/modules/audit/application/ports/audit-log.port'
import type { AuditEntry } from '@/modules/audit/domain/audit-entry/audit-entry'
import type { Name } from '@/modules/audit/domain/name/name'
import { mockStore } from '@/shared/infrastructure/mock-stores'

type Store = {
  entries: Map<string, AuditEntry>
  names: Map<string, { name: string; aggregateVersion: number }>
  inbox: Set<string>
}

/** The mock Audit log and name projections, shared with `MockActivityReader`. */
export function mockAudit(): Store {
  return mockStore('audit.log', () => ({
    entries: new Map(),
    names: new Map(),
    inbox: new Set<string>(),
  }))
}

/** The key of a name in the mock store. */
export function nameKey(kind: Name['kind'], id: string): string {
  return `${kind}|${id}`
}

/** In-memory twin of `AuditLog`: same inbox, id and version rules. */
export class MockAuditLog implements IAuditLog {
  async record(
    entry: AuditEntry,
    names: readonly Name[],
    receipt: Receipt
  ): Promise<void> {
    const store = mockAudit()
    const key = `${receipt.eventId}|${receipt.handler}`
    if (store.inbox.has(key)) return
    store.inbox.add(key)
    if (!store.entries.has(entry.id)) {
      store.entries.set(entry.id, structuredClone(entry))
    }
    for (const { kind, id, name, aggregateVersion } of names) {
      const stored = store.names.get(nameKey(kind, id))
      if (stored && stored.aggregateVersion >= aggregateVersion) continue
      store.names.set(nameKey(kind, id), { name, aggregateVersion })
    }
  }
}
