import type { UserId } from '@/shared/kernel/user-id'

/**
 * Something that happened inside an aggregate, raised by a domain function
 * and returned with the new state (§3). Its `type` has no context prefix.
 */
export type DomainEvent<Type extends string = string, Payload = unknown> = {
  readonly type: Type
  readonly payload: Payload
}

/**
 * A published fact for other contexts: `<context>.<Name>` at a version, with
 * a plain, serializable payload (§6). Translated from a domain event.
 */
export type IntegrationEvent<
  Type extends string = string,
  Payload = unknown,
> = {
  readonly type: Type
  readonly version: number
  readonly payload: Payload
}

/**
 * Who and what started a change. `actorId` is the user who started the
 * chain, and `causationId` is the id of the event a handler reacted to, or
 * null for a change a user made directly (§6).
 */
export type EventOrigin = {
  readonly actorId: UserId
  readonly causationId: string | null
}

/** The envelope every outbox row carries, and every handler receives (§6). */
export type EventEnvelope<Type extends string = string, Payload = unknown> = {
  /** UUID v7. */
  readonly id: string
  readonly type: Type
  readonly version: number
  /** ISO 8601. */
  readonly occurredAt: string
  readonly aggregateId: string
  readonly aggregateVersion: number
  readonly actorId: UserId
  readonly causationId: string | null
  readonly payload: Payload
}

/** The envelope a handler of integration event `E` receives. */
export type EnvelopeOf<E extends IntegrationEvent> = EventEnvelope<
  E['type'],
  E['payload']
>
