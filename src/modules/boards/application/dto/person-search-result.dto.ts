/** A Person found by email, as the Members tab offers them. */
export type PersonSearchResultDto = {
  userId: string
  displayName: string
  email: string
  /** Whether they are already a Board member of the board searched from. */
  isMember: boolean
}
