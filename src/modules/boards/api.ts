import 'server-only'

import { addMember as addMemberCommand } from '@/modules/boards/application/commands/add-member.command'
import { createBoard as createBoardCommand } from '@/modules/boards/application/commands/create-board.command'
import { createList as createListCommand } from '@/modules/boards/application/commands/create-list.command'
import { moveList as moveListCommand } from '@/modules/boards/application/commands/move-list.command'
import { renameBoard as renameBoardCommand } from '@/modules/boards/application/commands/rename-board.command'
import { leaveBoard as leaveBoardCommand } from '@/modules/boards/application/commands/leave-board.command'
import { removeMember as removeMemberCommand } from '@/modules/boards/application/commands/remove-member.command'
import { renameList as renameListCommand } from '@/modules/boards/application/commands/rename-list.command'
import { transferOwnership as transferOwnershipCommand } from '@/modules/boards/application/commands/transfer-ownership.command'
import { getBoard as getBoardQuery } from '@/modules/boards/application/queries/get-board.query'
import { listBoards as listBoardsQuery } from '@/modules/boards/application/queries/list-boards.query'
import { roleOf as roleOfQuery } from '@/modules/boards/application/queries/role-of.query'
import { searchUsers as searchUsersQuery } from '@/modules/boards/application/queries/search-users.query'
import { traced } from '@/shared/infrastructure/tracing'

// Public API of the boards context (§2): its commands and queries, each
// wrapped in `traced`, plus their DTO types and the errors they return.

export const createBoard = traced('boards.createBoard', createBoardCommand)
export const renameBoard = traced('boards.renameBoard', renameBoardCommand)
export const createList = traced('boards.createList', createListCommand)
export const renameList = traced('boards.renameList', renameListCommand)
export const moveList = traced('boards.moveList', moveListCommand)
export const addMember = traced('boards.addMember', addMemberCommand)
export const removeMember = traced('boards.removeMember', removeMemberCommand)
export const leaveBoard = traced('boards.leaveBoard', leaveBoardCommand)
export const transferOwnership = traced(
  'boards.transferOwnership',
  transferOwnershipCommand
)
export const listBoards = traced('boards.listBoards', listBoardsQuery)
export const getBoard = traced('boards.getBoard', getBoardQuery)
export const searchUsers = traced('boards.searchUsers', searchUsersQuery)
export const roleOf = traced('boards.roleOf', roleOfQuery)

export type { AddMemberInput } from '@/modules/boards/application/commands/add-member.command'
export type { CreateBoardInput } from '@/modules/boards/application/commands/create-board.command'
export type { CreateListInput } from '@/modules/boards/application/commands/create-list.command'
export type { MoveListInput } from '@/modules/boards/application/commands/move-list.command'
export type { LeaveBoardInput } from '@/modules/boards/application/commands/leave-board.command'
export type { RemoveMemberInput } from '@/modules/boards/application/commands/remove-member.command'
export type { RenameBoardInput } from '@/modules/boards/application/commands/rename-board.command'
export type { RenameListInput } from '@/modules/boards/application/commands/rename-list.command'
export type { TransferOwnershipInput } from '@/modules/boards/application/commands/transfer-ownership.command'
export type {
  BoardMemberDto,
  BoardSummaryDto,
} from '@/modules/boards/application/dto/board-summary.dto'
export type { BoardDto } from '@/modules/boards/application/dto/board.dto'
export type { ListDto } from '@/modules/boards/application/dto/list.dto'
export type { UserSearchResultDto } from '@/modules/boards/application/dto/user-search-result.dto'
export {
  AlreadyAMemberError,
  NotAMemberError,
  OwnerMustTransferFirstError,
} from '@/modules/boards/domain/board/board.errors'
export { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
export {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
