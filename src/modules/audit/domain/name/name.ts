/** The things audit keeps a current name for. */
export type NameKind = 'person' | 'board' | 'list' | 'task' | 'tag'

// #region name
/**
 * A current name in audit's name projections, learned from an event at
 * `aggregateVersion`. An older version than the stored one changes nothing.
 */
export type Name = {
  readonly kind: NameKind
  readonly id: string
  readonly name: string
  readonly aggregateVersion: number
}
// #endregion name
