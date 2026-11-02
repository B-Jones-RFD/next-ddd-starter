import { describe, expect, it } from 'vitest'

import type { IOutbox } from '@/shared/kernel/ports/outbox.port'

import { anOutboxEntry } from '@tests/fixtures/envelopes'

/** What every `IOutbox` adapter must do. `makeOutbox` returns an empty one. */
export function describeOutboxContract(makeOutbox: () => IOutbox) {
  describe('IOutbox contract', () => {
    it('returns appended rows oldest first, envelope and trace context intact', async () => {
      const outbox = makeOutbox()
      const first = anOutboxEntry({ type: 'identity.UserRegistered' })
      const second = {
        ...anOutboxEntry({ type: 'UserRegistered', causationId: 'event-0' }),
        scope: 'domain' as const,
        traceContext: {
          traceparent:
            '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
          tracestate: 'vendor=1',
        },
      }

      outbox.append([first])
      outbox.append([second])

      const rows = await outbox.pending(10)
      expect(rows).toEqual([
        { ...first, attempts: 0, nextAttemptAt: null, firstFailedAt: null },
        { ...second, attempts: 0, nextAttemptAt: null, firstFailedAt: null },
      ])
    })

    it('returns at most `limit` rows', async () => {
      const outbox = makeOutbox()
      outbox.append([anOutboxEntry(), anOutboxEntry(), anOutboxEntry()])

      expect(await outbox.pending(2)).toHaveLength(2)
    })

    it('stops returning a row once it is delivered, and keeps the rest in order', async () => {
      const outbox = makeOutbox()
      const [a, b] = [anOutboxEntry(), anOutboxEntry()]
      outbox.append([a, b])

      await outbox.markDelivered(a.envelope.id)

      const rows = await outbox.pending(10)
      expect(rows.map((row) => row.envelope.id)).toEqual([b.envelope.id])
    })

    it('keeps a retrying row pending with its attempts, next attempt and first failure', async () => {
      const outbox = makeOutbox()
      const entry = anOutboxEntry()
      outbox.append([entry])
      const firstFailure = new Date('2026-01-01T10:00:00.000Z')
      const secondFailure = new Date('2026-01-01T10:00:01.000Z')
      const nextAttemptAt = new Date('2026-01-01T10:00:03.000Z')

      await outbox.markRetrying(entry.envelope.id, {
        error: 'persistence',
        failedAt: firstFailure,
        nextAttemptAt: secondFailure,
      })
      await outbox.markRetrying(entry.envelope.id, {
        error: 'persistence',
        failedAt: secondFailure,
        nextAttemptAt,
      })

      const [row] = await outbox.pending(10)
      expect(row).toMatchObject({
        attempts: 2,
        nextAttemptAt,
        firstFailedAt: firstFailure,
      })
    })

    it('counts a delivery after failures as one more attempt, and no longer pending', async () => {
      const outbox = makeOutbox()
      const entry = anOutboxEntry()
      outbox.append([entry])
      await outbox.markRetrying(entry.envelope.id, {
        error: 'persistence',
        failedAt: new Date(),
        nextAttemptAt: new Date(),
      })

      await outbox.markDelivered(entry.envelope.id)

      expect(await outbox.pending(10)).toEqual([])
      expect((await outbox.backlog()).pending).toBe(0)
    })

    it('stops returning a failed row and counts it as failed', async () => {
      const outbox = makeOutbox()
      const [a, b] = [anOutboxEntry(), anOutboxEntry()]
      outbox.append([a, b])

      await outbox.markFailed(a.envelope.id, { error: 'bug' })

      const rows = await outbox.pending(10)
      expect(rows.map((row) => row.envelope.id)).toEqual([b.envelope.id])
      expect(await outbox.backlog()).toEqual({
        pending: 1,
        oldestPendingAt: new Date(b.envelope.occurredAt),
        failed: 1,
      })
    })

    it('replays failed rows: pending again, in their place, as if never tried, leaving the rest alone', async () => {
      const outbox = makeOutbox()
      const [delivered, failed, pending] = [
        anOutboxEntry(),
        anOutboxEntry(),
        anOutboxEntry(),
      ]
      outbox.append([delivered, failed, pending])
      await outbox.markDelivered(delivered.envelope.id)
      await outbox.markRetrying(failed.envelope.id, {
        error: 'persistence',
        failedAt: new Date('2026-01-01T10:00:00.000Z'),
        nextAttemptAt: new Date('2026-01-01T10:00:01.000Z'),
      })
      await outbox.markFailed(failed.envelope.id, { error: 'bug' })

      expect(await outbox.replayFailed()).toBe(1)

      expect(await outbox.pending(10)).toEqual([
        { ...failed, attempts: 2, nextAttemptAt: null, firstFailedAt: null },
        { ...pending, attempts: 0, nextAttemptAt: null, firstFailedAt: null },
      ])
      expect((await outbox.backlog()).failed).toBe(0)
      expect(await outbox.replayFailed()).toBe(0)
    })

    it('reports the backlog: pending and retrying rows, the oldest pending age, failed rows', async () => {
      const outbox = makeOutbox()
      expect(await outbox.backlog()).toEqual({
        pending: 0,
        oldestPendingAt: null,
        failed: 0,
      })

      const delivered = anOutboxEntry({
        occurredAt: '2026-01-01T09:00:00.000Z',
      })
      const retrying = anOutboxEntry({
        occurredAt: '2026-01-01T10:00:00.000Z',
      })
      const pending = anOutboxEntry({ occurredAt: '2026-01-01T11:00:00.000Z' })
      const failed = anOutboxEntry({ occurredAt: '2026-01-01T12:00:00.000Z' })
      outbox.append([delivered, retrying, pending, failed])
      await outbox.markDelivered(delivered.envelope.id)
      await outbox.markRetrying(retrying.envelope.id, {
        error: 'persistence',
        failedAt: new Date(),
        nextAttemptAt: new Date(),
      })
      await outbox.markFailed(failed.envelope.id, { error: 'bug' })

      expect(await outbox.backlog()).toEqual({
        pending: 2,
        oldestPendingAt: new Date('2026-01-01T10:00:00.000Z'),
        failed: 1,
      })
    })
  })
}
