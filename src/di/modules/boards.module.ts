import { createModule } from '@evyweb/ioctopus'

import type { AdapterMode, Registry } from '@/di/types'

/** Boards' bindings. Mocks load through `import()` only in mock mode. */
export async function loadBoardsModule(mode: AdapterMode) {
  const boards = createModule<Registry>()

  if (mode === 'mock') {
    const [
      { MockOutbox },
      { MockPeopleProjection },
      { MockBoardRepository },
      { MockBoardReader },
    ] = await Promise.all([
      import('@/shared/infrastructure/outbox/outbox.mock'),
      import('@/modules/boards/infrastructure/people-projection.mock'),
      import('@/modules/boards/infrastructure/board-repository.mock'),
      import('@/modules/boards/infrastructure/board-reader.mock'),
    ])
    const outbox = new MockOutbox('boards')
    boards
      .bind('IPeopleProjection')
      .toClass(MockPeopleProjection, undefined, 'singleton')
    boards
      .bind('IBoardRepository')
      .toFactory(() => new MockBoardRepository(outbox), 'singleton')
    boards.bind('IBoardReader').toClass(MockBoardReader, undefined, 'singleton')
    return boards
  }

  const [
    { getDatabase },
    { Outbox },
    { PeopleProjection },
    { BoardRepository },
    { BoardReader },
  ] = await Promise.all([
    import('@/shared/infrastructure/sqlite/database'),
    import('@/shared/infrastructure/outbox/outbox'),
    import('@/modules/boards/infrastructure/people-projection'),
    import('@/modules/boards/infrastructure/board-repository'),
    import('@/modules/boards/infrastructure/board-reader'),
  ])
  boards
    .bind('IPeopleProjection')
    .toFactory(() => new PeopleProjection(getDatabase()), 'singleton')
  boards
    .bind('IBoardRepository')
    .toFactory(
      () =>
        new BoardRepository(getDatabase(), new Outbox(getDatabase(), 'boards')),
      'singleton'
    )
  boards
    .bind('IBoardReader')
    .toFactory(() => new BoardReader(getDatabase()), 'singleton')
  return boards
}
