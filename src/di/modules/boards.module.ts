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
      { MockTaskRepository },
      { MockCommentRepository },
      { UserDirectory },
    ] = await Promise.all([
      import('@/shared/infrastructure/outbox/outbox.mock'),
      import('@/modules/boards/infrastructure/people-projection.mock'),
      import('@/modules/boards/infrastructure/board-repository.mock'),
      import('@/modules/boards/infrastructure/board-reader.mock'),
      import('@/modules/boards/infrastructure/list-repository.mock'),
      import('@/modules/boards/infrastructure/task-repository.mock'),
      import('@/modules/boards/infrastructure/comment-repository.mock'),
      // No IO of its own: it asks identity's api.ts, which is on mocks too.
      import('@/modules/boards/infrastructure/user-directory'),
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
    boards
      .bind('ITaskRepository')
      .toFactory(() => new MockTaskRepository(outbox), 'singleton')
    // #region comment-mock
    boards
      .bind('ICommentRepository')
      .toFactory(() => new MockCommentRepository(outbox), 'singleton')
    // #endregion comment-mock
    boards.bind('IUserDirectory').toClass(UserDirectory, undefined, 'singleton')
    return boards
  }

  const [
    { getDatabase },
    { Outbox },
    { PeopleProjection },
    { BoardRepository },
    { BoardReader },
    { ListRepository },
    { TaskRepository },
    { CommentRepository },
    { UserDirectory },
  ] = await Promise.all([
    import('@/shared/infrastructure/sqlite/database'),
    import('@/shared/infrastructure/outbox/outbox'),
    import('@/modules/boards/infrastructure/people-projection'),
    import('@/modules/boards/infrastructure/board-repository'),
    import('@/modules/boards/infrastructure/board-reader'),
    import('@/modules/boards/infrastructure/list-repository'),
    import('@/modules/boards/infrastructure/task-repository'),
    import('@/modules/boards/infrastructure/comment-repository'),
    import('@/modules/boards/infrastructure/user-directory'),
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
  boards
    .bind('ITaskRepository')
    .toFactory(
      () =>
        new TaskRepository(getDatabase(), new Outbox(getDatabase(), 'boards')),
      'singleton'
    )
  // #region comment-real
  boards
    .bind('ICommentRepository')
    .toFactory(
      () =>
        new CommentRepository(
          getDatabase(),
          new Outbox(getDatabase(), 'boards')
        ),
      'singleton'
    )
  // #endregion comment-real
  boards.bind('IUserDirectory').toClass(UserDirectory, undefined, 'singleton')
  return boards
}
