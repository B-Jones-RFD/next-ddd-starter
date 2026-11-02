import { describe } from 'vitest'

import { ActivityReader } from '@/modules/audit/infrastructure/activity-reader'
import { MockActivityReader } from '@/modules/audit/infrastructure/activity-reader.mock'
import { AuditLog } from '@/modules/audit/infrastructure/audit-log'
import { MockAuditLog } from '@/modules/audit/infrastructure/audit-log.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

import { describeActivityReaderContract } from '@tests/contracts/activity-reader.contract'
import { describeAuditLogContract } from '@tests/contracts/audit-log.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

// The log and its reader share one store, so each suite runs on both.
function real() {
  const db = givenMigratedDatabase()
  return { log: new AuditLog(db), reader: new ActivityReader(db) }
}

function mock() {
  resetMockStores()
  return { log: new MockAuditLog(), reader: new MockActivityReader() }
}

describe('AuditLog and ActivityReader (SQLite)', () => {
  describeAuditLogContract(real)
  describeActivityReaderContract(real)
})

describe('MockAuditLog and MockActivityReader', () => {
  describeAuditLogContract(mock)
  describeActivityReaderContract(mock)
})
