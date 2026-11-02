import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { EventRelay } from '@/shared/infrastructure/outbox/event-relay'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'
import type { EventEnvelope } from '@/shared/kernel/events'
import type { EventHandler } from '@/shared/kernel/ports/event-relay.port'

import { anOutboxEntry } from '@tests/fixtures/envelopes'

const outage = () => new PersistenceError('IPeople', { retryable: true })

/** A handler that records the ids of the envelopes it receives. */
function recordingHandler(
  overrides: Partial<EventHandler> = {}
): EventHandler & { seen: string[] } {
  const seen: string[] = []
  return {
    name: 'boards.recordUserRegistered',
    eventType: 'identity.UserRegistered',
    version: 1,
    handle: async (envelope: EventEnvelope) => {
      seen.push(envelope.id)
    },
    ...overrides,
    seen,
  }
}

describe('EventRelay', () => {
  beforeEach(() => {
    resetMockStores()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    'recordUserRegistered',
    'Boards.recordX',
    'boards.RecordX',
    'boards',
  ])('refuses to register a handler named %s', (name) => {
    expect(
      () =>
        new EventRelay({
          outboxes: [],
          handlers: [recordingHandler({ name })],
        })
    ).toThrow(name)
  })

  it('delivers each row in id order to the handlers of its type and version', async () => {
    const identity = new MockOutbox('identity')
    const handler = recordingHandler()
    const otherVersion = recordingHandler({
      name: 'boards.recordUserRegisteredV2',
      version: 2,
    })
    const relay = new EventRelay({
      outboxes: [identity],
      handlers: [handler, otherVersion],
    })
    const [a, b, c] = [anOutboxEntry(), anOutboxEntry(), anOutboxEntry()]
    identity.append([a, b])
    identity.append([c])

    await relay.drain()

    expect(handler.seen).toEqual([a, b, c].map((row) => row.envelope.id))
    expect(otherVersion.seen).toEqual([])
    expect(await identity.pending(10)).toEqual([])
  })

  it('delivers a domain row only to handlers of the same module', async () => {
    const identity = new MockOutbox('identity')
    const own = recordingHandler({
      name: 'identity.welcomeUser',
      eventType: 'UserRegistered',
    })
    const other = recordingHandler({
      name: 'boards.watchUsers',
      eventType: 'UserRegistered',
    })
    const relay = new EventRelay({
      outboxes: [identity],
      handlers: [own, other],
    })
    const entry = {
      ...anOutboxEntry({ type: 'UserRegistered' }),
      scope: 'domain' as const,
    }
    identity.append([entry])

    await relay.drain()

    expect(own.seen).toEqual([entry.envelope.id])
    expect(other.seen).toEqual([])
  })

  it('retries a retryable failure with backoff while the stream waits', async () => {
    const identity = new MockOutbox('identity')
    const handler = recordingHandler()
    const handle = vi
      .fn(handler.handle)
      .mockRejectedValueOnce(outage())
      .mockRejectedValueOnce(outage())
    const relay = new EventRelay({
      outboxes: [identity],
      handlers: [{ ...handler, handle }],
    })
    const [first, second] = [anOutboxEntry(), anOutboxEntry()]
    identity.append([first, second])

    await relay.drain()
    expect(handler.seen).toEqual([])
    expect(await identity.pending(10)).toHaveLength(2)

    vi.setSystemTime(new Date('2026-01-01T10:00:01.000Z'))
    await relay.drain()
    expect(handler.seen).toEqual([])

    vi.setSystemTime(new Date('2026-01-01T10:00:03.000Z'))
    await relay.drain()
    expect(handler.seen).toEqual([first.envelope.id, second.envelope.id])
    expect(await identity.backlog()).toMatchObject({ pending: 0, failed: 0 })
  })

  it('caps the backoff at 60 s', async () => {
    const identity = new MockOutbox('identity')
    const relay = new EventRelay({
      outboxes: [identity],
      handlers: [
        recordingHandler({
          handle: async () => {
            throw outage()
          },
        }),
      ],
    })
    identity.append([anOutboxEntry()])

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await relay.drain()
      vi.setSystemTime(new Date(Date.now() + 120_000))
    }
    await relay.drain()

    const [row] = await identity.pending(1)
    expect(row?.attempts).toBe(11)
    expect(row?.nextAttemptAt?.getTime()).toBe(Date.now() + 60_000)
  })

  it('marks any other failure failed and moves on', async () => {
    const identity = new MockOutbox('identity')
    const handler = recordingHandler()
    const handle = vi
      .fn(handler.handle)
      .mockRejectedValueOnce(new TypeError('payload.userId is undefined'))
    const relay = new EventRelay({
      outboxes: [identity],
      handlers: [{ ...handler, handle }],
    })
    const [bad, good] = [anOutboxEntry(), anOutboxEntry()]
    identity.append([bad, good])

    await relay.drain()

    expect(handler.seen).toEqual([good.envelope.id])
    expect(await identity.backlog()).toMatchObject({ pending: 0, failed: 1 })
  })

  it('treats a non-retryable outage as a failure', async () => {
    const identity = new MockOutbox('identity')
    const relay = new EventRelay({
      outboxes: [identity],
      handlers: [
        recordingHandler({
          handle: async () => {
            throw new PersistenceError('IPeople', { retryable: false })
          },
        }),
      ],
    })
    identity.append([anOutboxEntry()])

    await relay.drain()

    expect(await identity.backlog()).toMatchObject({ pending: 0, failed: 1 })
  })

  it('runs one drain at a time, so concurrent drains deliver each row once', async () => {
    const identity = new MockOutbox('identity')
    const handler = recordingHandler()
    const relay = new EventRelay({
      outboxes: [identity],
      handlers: [handler],
    })
    const entries = [anOutboxEntry(), anOutboxEntry(), anOutboxEntry()]
    identity.append(entries)

    await Promise.all([relay.drain(), relay.drain(), relay.drain()])

    expect(handler.seen).toEqual(entries.map((entry) => entry.envelope.id))
  })

  it('delivers rows appended while a drain runs before a later drain resolves', async () => {
    const identity = new MockOutbox('identity')
    const late = anOutboxEntry()
    const handler = recordingHandler()
    let appended = false
    const relay = new EventRelay({
      outboxes: [identity],
      handlers: [
        {
          ...handler,
          handle: async (envelope) => {
            await handler.handle(envelope)
            if (!appended) {
              appended = true
              identity.append([late])
            }
          },
        },
      ],
    })
    identity.append([anOutboxEntry()])

    const first = relay.drain()
    const second = relay.drain()
    await Promise.all([first, second])

    expect(handler.seen).toContain(late.envelope.id)
  })

  it('marks a row delivered only when every handler succeeds, redelivering to all', async () => {
    const identity = new MockOutbox('identity')
    const projection = recordingHandler()
    const audit = recordingHandler({ name: 'audit.recordUserRegistered' })
    const auditHandle = vi.fn(audit.handle).mockRejectedValueOnce(outage())
    const relay = new EventRelay({
      outboxes: [identity],
      handlers: [projection, { ...audit, handle: auditHandle }],
    })
    const entry = anOutboxEntry()
    identity.append([entry])

    await relay.drain()
    expect(await identity.pending(10)).toHaveLength(1)

    vi.setSystemTime(new Date('2026-01-01T10:01:00.000Z'))
    await relay.drain()

    expect(projection.seen).toEqual([entry.envelope.id, entry.envelope.id])
    expect(audit.seen).toEqual([entry.envelope.id])
    expect(await identity.pending(10)).toEqual([])
  })
})
