import type { BoardMemberDto } from '@/modules/boards/application/dto/board-summary.dto'
import type { ListDto } from '@/modules/boards/application/dto/list.dto'

/** One board, as the Board member reading it sees it. */
export type BoardDto = {
  id: string
  name: string
  archived: boolean
  /** The reader's own role, so pages can hide what they may not do. */
  role: 'owner' | 'member'
  /** Owner first. */
  members: BoardMemberDto[]
  /**
   * Its lists in the view, in board order: the Active view has the active
   * lists with their active tasks, and the Archived view has the archived
   * lists and any list holding an archived task, with their archived tasks.
   */
  lists: ListDto[]
}
