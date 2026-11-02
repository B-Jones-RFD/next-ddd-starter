import { createModule } from '@evyweb/ioctopus'

import type { AdapterMode, Registry } from '@/di/types'

/** Boards' bindings. Mocks load through `import()` only in mock mode. */
export async function loadBoardsModule(mode: AdapterMode) {
  const boards = createModule<Registry>()

  if (mode === 'mock') {
    const { MockPeopleProjection } =
      await import('@/modules/boards/infrastructure/people-projection.mock')
    boards
      .bind('IPeopleProjection')
      .toClass(MockPeopleProjection, undefined, 'singleton')
    return boards
  }

  const [{ getDatabase }, { PeopleProjection }] = await Promise.all([
    import('@/shared/infrastructure/sqlite/database'),
    import('@/modules/boards/infrastructure/people-projection'),
  ])
  boards
    .bind('IPeopleProjection')
    .toFactory(() => new PeopleProjection(getDatabase()), 'singleton')
  return boards
}
