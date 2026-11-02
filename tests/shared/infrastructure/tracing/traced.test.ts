import { SpanStatusCode } from '@opentelemetry/api'
import { describe, expect, it } from 'vitest'

import { traced } from '@/shared/infrastructure/tracing'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'
import { err, ok } from '@/shared/kernel/result'

import { recordedSpans } from '@tests/fixtures/spans'

// `traced` is tested once, here (§8). Feature tests never assert on spans.

describe('traced', () => {
  it('names the span and sets app.module, recording nothing from input', async () => {
    const findTask = traced('boards.findTask', async (input: { id: string }) =>
      ok(input.id)
    )

    await findTask({ id: 'task-1' })

    const [span] = recordedSpans()
    expect(span?.name).toBe('boards.findTask')
    expect(span?.attributes).toEqual({ 'app.module': 'boards' })
    expect(span?.status.code).toBe(SpanStatusCode.UNSET)
  })

  it('records an expected error by code and leaves the status unset', async () => {
    const findTask = traced('boards.findTask', async () =>
      err(new NotFoundError('Task', 'task-1'))
    )

    const result = await findTask()

    expect(result.ok).toBe(false)
    const [span] = recordedSpans()
    expect(span?.attributes).toMatchObject({
      'app.error.kind': 'expected',
      'app.error.code': 'not-found',
    })
    expect(span?.status.code).toBe(SpanStatusCode.UNSET)
  })

  it('records a thrown error with its cause, sets ERROR and rethrows the same object', async () => {
    const cause = new Error('SQLITE_BUSY: database is locked')
    const outage = new PersistenceError('ITaskRepository', {
      retryable: true,
      cause,
    })
    const moveTask = traced('boards.moveTask', async () => {
      throw outage
    })

    await expect(moveTask()).rejects.toBe(outage)

    const [span] = recordedSpans()
    expect(span?.status.code).toBe(SpanStatusCode.ERROR)
    expect(span?.attributes).toMatchObject({
      'app.error.kind': 'thrown',
      'app.error.code': 'persistence',
    })
    expect(
      span?.events.map((event) => event.attributes?.['exception.message'])
    ).toEqual([outage.message, cause.message])
  })

  it('nests a traced call under the outer one', async () => {
    const inner = traced('identity.findUser', async () => ok(1))
    const outer = traced('boards.addMember', async () => inner())

    await outer()

    const spans = recordedSpans()
    const innerSpan = spans.find((s) => s.name === 'identity.findUser')
    const outerSpan = spans.find((s) => s.name === 'boards.addMember')
    expect(innerSpan?.parentSpanContext?.spanId).toBe(
      outerSpan?.spanContext().spanId
    )
    expect(innerSpan?.spanContext().traceId).toBe(
      outerSpan?.spanContext().traceId
    )
  })
})
