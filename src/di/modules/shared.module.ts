import { createModule } from '@evyweb/ioctopus'

import type { AdapterMode, Registry } from '@/di/types'

/**
 * Bindings for technical ports every context uses. Adapters are loaded with
 * `import()` so mocks are only evaluated in mock mode.
 */
export async function loadSharedModule(mode: AdapterMode) {
  const shared = createModule<Registry>()

  if (mode === 'mock') {
    const { MockIdGenerator } =
      await import('@/shared/infrastructure/id-generator.mock')
    shared.bind('IIdGenerator').toClass(MockIdGenerator, undefined, 'singleton')
  } else {
    const { IdGenerator } = await import('@/shared/infrastructure/id-generator')
    shared.bind('IIdGenerator').toClass(IdGenerator, undefined, 'singleton')
  }

  return shared
}
