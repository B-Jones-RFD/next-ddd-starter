import { createModule } from '@evyweb/ioctopus'

import type { AdapterMode, Registry } from '@/di/types'

/**
 * Bindings for technical ports every context uses. Adapters are loaded with
 * `import()` so mocks are only evaluated in mock mode.
 */
export async function loadSharedModule(mode: AdapterMode) {
  const shared = createModule<Registry>()
  // Handlers import the container, so the list loads only once it's built.
  const [{ EventRelay }, { EVENT_HANDLERS, OUTBOX_NAMES }] = await Promise.all([
    import('@/shared/infrastructure/outbox/event-relay'),
    import('@/di/event-handlers'),
  ])

  if (mode === 'mock') {
    const [{ MockIdGenerator }, { MockOutbox }] = await Promise.all([
      import('@/shared/infrastructure/id-generator.mock'),
      import('@/shared/infrastructure/outbox/outbox.mock'),
    ])
    shared.bind('IIdGenerator').toClass(MockIdGenerator, undefined, 'singleton')
    shared.bind('IEventRelay').toFactory(
      () =>
        new EventRelay({
          outboxes: OUTBOX_NAMES.map((name) => new MockOutbox(name)),
          handlers: EVENT_HANDLERS,
        }),
      'singleton'
    )
    return shared
  }

  const [{ IdGenerator }, { Outbox }, { getDatabase }] = await Promise.all([
    import('@/shared/infrastructure/id-generator'),
    import('@/shared/infrastructure/outbox/outbox'),
    import('@/shared/infrastructure/sqlite/database'),
  ])
  shared.bind('IIdGenerator').toClass(IdGenerator, undefined, 'singleton')
  shared.bind('IEventRelay').toFactory(
    () =>
      new EventRelay({
        outboxes: OUTBOX_NAMES.map((name) => new Outbox(getDatabase(), name)),
        handlers: EVENT_HANDLERS,
      }),
    'singleton'
  )
  return shared
}
