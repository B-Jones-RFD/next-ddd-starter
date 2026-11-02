import { createModule } from '@evyweb/ioctopus'

import type { AdapterMode, Registry } from '@/di/types'

/** Audit's bindings. Mocks load through `import()` only in mock mode. */
export async function loadAuditModule(mode: AdapterMode) {
  const audit = createModule<Registry>()

  if (mode === 'mock') {
    const [{ MockAuditLog }, { MockActivityReader }, { BoardAccess }] =
      await Promise.all([
        import('@/modules/audit/infrastructure/audit-log.mock'),
        import('@/modules/audit/infrastructure/activity-reader.mock'),
        // No IO of its own: it asks boards' api.ts, which is on mocks too.
        import('@/modules/audit/infrastructure/board-access'),
      ])
    audit.bind('IAuditLog').toClass(MockAuditLog, undefined, 'singleton')
    audit
      .bind('IActivityReader')
      .toClass(MockActivityReader, undefined, 'singleton')
    audit.bind('IBoardAccess').toClass(BoardAccess, undefined, 'singleton')
    return audit
  }

  const [{ getDatabase }, { AuditLog }, { ActivityReader }, { BoardAccess }] =
    await Promise.all([
      import('@/shared/infrastructure/sqlite/database'),
      import('@/modules/audit/infrastructure/audit-log'),
      import('@/modules/audit/infrastructure/activity-reader'),
      import('@/modules/audit/infrastructure/board-access'),
    ])
  audit
    .bind('IAuditLog')
    .toFactory(() => new AuditLog(getDatabase()), 'singleton')
  audit
    .bind('IActivityReader')
    .toFactory(() => new ActivityReader(getDatabase()), 'singleton')
  audit.bind('IBoardAccess').toClass(BoardAccess, undefined, 'singleton')
  return audit
}
