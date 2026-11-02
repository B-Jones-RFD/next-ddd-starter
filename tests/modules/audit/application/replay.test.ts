import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import { getUserLog } from '@/modules/audit/api'
import type { IAuditLog } from '@/modules/audit/application/ports/audit-log.port'
import { rename } from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import type { UserId } from '@/shared/kernel/user-id'

import { givenUser } from '@tests/fixtures/users'

let ada: UserId

async function relay() {
  return getInjection('IEventRelay')
}

async function userLogActions() {
  const page = await getUserLog({ actorId: ada })
  if (!page.ok) throw new Error('read failed')
  return page.value.entries.map((entry) => entry.action)
}

/** Makes the next `record` a bug: it fails without a retry. */
async function failNextRecord(after: 'before' | 'after' = 'before') {
  const log = await getInjection('IAuditLog')
  const record = log.record.bind(log)
  vi.spyOn(log, 'record').mockImplementationOnce(
    async (...args: Parameters<IAuditLog['record']>) => {
      if (after === 'after') await record(...args)
      throw new Error('bug')
    }
  )
}

beforeEach(async () => {
  resetMockStores()
  ada = await givenUser('Ada', 'ada@example.com')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('replaying failed outbox rows', () => {
  it('delivers a failed row again once replayed, and only once', async () => {
    await failNextRecord()
    await rename({ actorId: ada, displayName: 'Ada L.' })
    await (await relay()).drain()
    expect(await userLogActions()).not.toContain('user.renamed')

    expect(await (await relay()).replayFailed()).toBe(1)
    await (await relay()).drain()
    await (await relay()).drain()

    expect(await userLogActions()).toEqual([
      'user.renamed',
      'user.signed-in',
      'user.registered',
    ])
    expect(await (await relay()).replayFailed()).toBe(0)
  })

  it('never applies a replayed event twice where a handler already applied it', async () => {
    // The entry is recorded, then the handler fails: the row is failed, but
    // the inbox already holds its receipt.
    await failNextRecord('after')
    await rename({ actorId: ada, displayName: 'Ada L.' })
    await (await relay()).drain()

    await (await relay()).replayFailed()
    await (await relay()).drain()

    expect(await userLogActions()).toEqual([
      'user.renamed',
      'user.signed-in',
      'user.registered',
    ])
  })
})
