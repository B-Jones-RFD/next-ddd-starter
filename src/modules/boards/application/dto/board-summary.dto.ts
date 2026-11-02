/** A Board member as a board's pages show them. */
export type BoardMemberDto = {
  userId: string
  /** From boards' people projection; null until boards learns it. */
  displayName: string | null
  role: 'owner' | 'member'
}

/** A board as listed on `/boards`, with its members, Owner first. */
export type BoardSummaryDto = {
  id: string
  name: string
  members: BoardMemberDto[]
}
