import { createContainer, type Container } from '@evyweb/ioctopus'

import { loadSharedModule } from '@/di/modules/shared.module'
import type { AdapterMode, Registry, Token } from '@/di/types'

/** Variables the real adapters need. Missing any of them in development falls back to mock mode. */
const REQUIRED_ENV = ['DATABASE_PATH'] as const

/**
 * Picks real or mock adapters, in order:
 * 1. `ADAPTERS=real|mock` wins if set.
 * 2. `NODE_ENV=test` means mock.
 * 3. Development missing a required variable means mock, with a warning.
 * Production refuses to run in mock mode.
 */
export function pickAdapterMode(env: NodeJS.ProcessEnv): AdapterMode {
  const isProduction = env.NODE_ENV === 'production'
  const explicit = env.ADAPTERS

  if (explicit !== undefined && explicit !== 'real' && explicit !== 'mock') {
    throw new Error(`ADAPTERS must be "real" or "mock", got "${explicit}".`)
  }

  let mode: AdapterMode
  if (explicit !== undefined) {
    mode = explicit
  } else if (env.NODE_ENV === 'test') {
    mode = 'mock'
  } else {
    const missing = REQUIRED_ENV.filter((name) => !env[name])
    if (missing.length === 0) {
      mode = 'real'
    } else if (isProduction) {
      throw new Error(`Missing required environment: ${missing.join(', ')}.`)
    } else {
      console.warn(
        `[di] Missing ${missing.join(', ')}; running on mock adapters. Set them, or ADAPTERS=mock to silence this.`
      )
      mode = 'mock'
    }
  }

  if (mode === 'mock' && isProduction) {
    throw new Error('Refusing to start production on mock adapters.')
  }
  return mode
}

async function buildContainer(): Promise<Container> {
  const mode = pickAdapterMode(process.env)
  // Untyped container: modules are typed against `Registry`, and
  // `getInjection` is the typed surface.
  const container = createContainer()
  container.load(Symbol('shared'), await loadSharedModule(mode))
  return container
}

let containerPromise: Promise<Container> | undefined

/**
 * Resolves an adapter by its port token. Call it inside a command or query
 * body, never at module top level, so importing `api.ts` never builds the
 * container. The container is built on first call; the mode is picked once.
 */
export async function getInjection<K extends Token>(
  token: K
): Promise<Registry[K]> {
  containerPromise ??= buildContainer()
  const container = await containerPromise
  return container.get<Registry[K]>(token)
}
