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
      { MockListRepository },
    ] = await Promise.all([
      import('@/shared/infrastructure/outbox/outbox.mock'),
      import('@/modules/boards/infrastructure/people-projection.mock'),
      import('@/modules/boards/infrastructure/board-repository.mock'),
      import('@/modules/boards/infrastructure/board-reader.mock'),
      import('@/modules/boards/infrastructure/list-repository.mock'),
    ])
    const outbox = new MockOutbox('boards')
    boards
      .bind('IPeopleProjection')
      .toClass(MockPeopleProjection, undefined, 'singleton')
    boards
      .bind('IBoardRepository')
      .toFactory(() => new MockBoardRepository(outbox), 'singleton')
    boards.bind('IBoardReader').toClass(MockBoardReader, undefined, 'singleton')
    boards
      .bind('IListRepository')
      .toFactory(() => new MockListRepository(outbox), 'singleton')
    return boards
  }

  const [
    { getDatabase },
    { Outbox },
    { PeopleProjection },
    { BoardRepository },
    { BoardReader },
    { ListRepository },
  ] = await Promise.all([
    import('@/shared/infrastructure/sqlite/database'),
    import('@/shared/infrastructure/outbox/outbox'),
    import('@/modules/boards/infrastructure/people-projection'),
    import('@/modules/boards/infrastructure/board-repository'),
    import('@/modules/boards/infrastructure/board-reader'),
    import('@/modules/boards/infrastructure/list-repository'),
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
  boards
    .bind('IListRepository')
    .toFactory(
      () =>
        new ListRepository(getDatabase(), new Outbox(getDatabase(), 'boards')),
      'singleton'
    )
  return boards
}
