import type { IIdGenerator } from '@/shared/kernel/ports/id-generator.port'

/**
 * Maps each injection token to its port type. A token is the port's interface
 * name and must be unique across the repo.
 */
export type Registry = {
  IIdGenerator: IIdGenerator
}

export type Token = keyof Registry

export type AdapterMode = 'real' | 'mock'
