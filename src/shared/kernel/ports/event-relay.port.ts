import type { EventEnvelope } from '@/shared/kernel/events'

/**
 * An event handler, registered with the relay under `<module>.<camelCaseName>`
 * (`boards.recordUserRegistered`). It throws to signal failure.
 */
export type EventHandler = {
  readonly name: string
  /** The envelope type it handles: `identity.UserRegistered`, or a domain type. */
  readonly eventType: string
  readonly version: number
  readonly handle: (envelope: EventEnvelope) => Promise<void>
}

/** Declares a handler with the envelope type it expects. */
export function eventHandler<Type extends string, Payload>(handler: {
  name: string
  eventType: Type
  version: number
  handle: (envelope: EventEnvelope<Type, Payload>) => Promise<void>
}): EventHandler {
  // The relay routes by `eventType` and `version`, so the envelope it passes
  // has this handler's type.
  return handler as unknown as EventHandler
}

// #region port
/**
 * Delivers every outbox's rows to their handlers (§6). In-process here; a
 * worker could replace it behind this port (§13).
 */
export interface IEventRelay {
  /** Starts polling. Idempotent. */
  start(): void
  /** Stops polling and waits for the current drain. */
  stop(): Promise<void>
  /** Asks for a drain soon. Never waits. */
  kick(): void
  /** Delivers every row that is due, then resolves. Single-flight. */
  drain(): Promise<void>
  /**
   * Makes every outbox's failed rows pending again, so the next drain
   * delivers them; inboxes drop what a handler already applied. Returns
   * how many rows it reset. For `npm run outbox:replay`.
   */
  replayFailed(): Promise<number>
}
// #endregion port
