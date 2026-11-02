import type { UserId } from '@/shared/kernel/user-id'

/** A user's part on a board, as audit needs it to decide who reads what. */
export type BoardRole = 'owner' | 'member'

// #region port
/**
 * Who may read a board's entries, asked of boards at read time (ADR 0010),
 * so a removed member or a former Owner loses access at once. Throws
 * `PersistenceError` on an outage.
 */
export interface IBoardAccess {
  /** `userId`'s role on the board, or null if they aren't a Board member. */
  roleOf(boardId: string, userId: UserId): Promise<BoardRole | null>
}
// #endregion port
