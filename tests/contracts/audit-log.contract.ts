import { describe, expect, it } from 'vitest'

import { anEntry, receiptFor, type AuditAdapters } from '@tests/fixtures/audit'

const PAGE = { before: null, limit: 50, excluding: [] }

/** What every `IAuditLog` adapter must do, observed through its reader. */
export function describeAuditLogContract(make: () => AuditAdapters) {
  describe('IAuditLog contract', () => {
    it('appends an entry, readable with every field', async () => {
      const { log, reader } = make()
      const entry = anEntry({ causationId: 'event-cause' })

      await log.record(entry, [], receiptFor(entry))

      expect(await reader.forTask('task-1', PAGE)).toEqual([
        {
          id: entry.id,
          occurredAt: '2026-03-01T10:00:00.000Z',
          actorId: 'user-ada',
          action: 'task.renamed',
          details: { from: 'A', to: 'B' },
          causationId: 'event-cause',
        },
      ])
    })

    it('drops an event its handler already recorded', async () => {
      const { log, reader } = make()
      const entry = anEntry()

      await log.record(entry, [], receiptFor(entry))
      await log.record(
        entry,
        [{ kind: 'task', id: 'task-1', name: 'Late', aggregateVersion: 9 }],
        receiptFor(entry)
      )

      expect(await reader.forTask('task-1', PAGE)).toHaveLength(1)
      expect(await reader.names(['task-1'])).toEqual({})
    })

    it('keeps one entry per id, whichever handler records it', async () => {
      const { log, reader } = make()
      const entry = anEntry()

      await log.record(entry, [], receiptFor(entry))
      await log.record(entry, [], receiptFor(entry, 'audit.recordOther'))

      expect(await reader.forTask('task-1', PAGE)).toHaveLength(1)
    })

    it('applies a newer name and ignores an older one', async () => {
      const { log, reader } = make()
      const first = anEntry()
      const second = anEntry()
      const stale = anEntry()

      await log.record(
        first,
        [{ kind: 'list', id: 'list-1', name: 'Todo', aggregateVersion: 1 }],
        receiptFor(first)
      )
      await log.record(
        second,
        [{ kind: 'list', id: 'list-1', name: 'Backlog', aggregateVersion: 3 }],
        receiptFor(second)
      )
      await log.record(
        stale,
        [{ kind: 'list', id: 'list-1', name: 'Old', aggregateVersion: 2 }],
        receiptFor(stale)
      )

      expect(await reader.names(['list-1'])).toEqual({ 'list-1': 'Backlog' })
    })
  })
}
