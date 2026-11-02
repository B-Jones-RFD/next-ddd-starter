import type { BoardMemberDto } from '@/modules/boards/application/dto/board-summary.dto'

/** One board, as the Board member reading it sees it. */
export type BoardDto = {
  id: string
  name: string
  archived: boolean
  /** The reader's own role, so pages can hide what they may not do. */
  role: 'owner' | 'member'
  /** Owner first. */
  members: BoardMemberDto[]
}
