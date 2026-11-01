/** Mints identifiers for new aggregates and entries. */
export interface IIdGenerator {
  next(): string
}
