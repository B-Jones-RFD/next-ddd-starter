import 'server-only'

import { changeTaskDescription as changeTaskDescriptionCommand } from '@/modules/boards/application/commands/change-task-description.command'
import { addMember as addMemberCommand } from '@/modules/boards/application/commands/add-member.command'
import { archiveBoard as archiveBoardCommand } from '@/modules/boards/application/commands/archive-board.command'
import { archiveList as archiveListCommand } from '@/modules/boards/application/commands/archive-list.command'
import { archiveTask as archiveTaskCommand } from '@/modules/boards/application/commands/archive-task.command'
import { createBoard as createBoardCommand } from '@/modules/boards/application/commands/create-board.command'
import { createList as createListCommand } from '@/modules/boards/application/commands/create-list.command'
import { createTask as createTaskCommand } from '@/modules/boards/application/commands/create-task.command'
import { moveList as moveListCommand } from '@/modules/boards/application/commands/move-list.command'
import { moveTask as moveTaskCommand } from '@/modules/boards/application/commands/move-task.command'
import { renameBoard as renameBoardCommand } from '@/modules/boards/application/commands/rename-board.command'
import { leaveBoard as leaveBoardCommand } from '@/modules/boards/application/commands/leave-board.command'
import { removeMember as removeMemberCommand } from '@/modules/boards/application/commands/remove-member.command'
import { renameList as renameListCommand } from '@/modules/boards/application/commands/rename-list.command'
import { renameTask as renameTaskCommand } from '@/modules/boards/application/commands/rename-task.command'
import { reorderTask as reorderTaskCommand } from '@/modules/boards/application/commands/reorder-task.command'
import { restoreBoard as restoreBoardCommand } from '@/modules/boards/application/commands/restore-board.command'
import { restoreList as restoreListCommand } from '@/modules/boards/application/commands/restore-list.command'
import { restoreTask as restoreTaskCommand } from '@/modules/boards/application/commands/restore-task.command'
import { transferOwnership as transferOwnershipCommand } from '@/modules/boards/application/commands/transfer-ownership.command'
import { getBoard as getBoardQuery } from '@/modules/boards/application/queries/get-board.query'
import { getTask as getTaskQuery } from '@/modules/boards/application/queries/get-task.query'
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
export const createTask = traced('boards.createTask', createTaskCommand)
export const renameTask = traced('boards.renameTask', renameTaskCommand)
export const changeTaskDescription = traced(
  'boards.changeTaskDescription',
  changeTaskDescriptionCommand
)
export const reorderTask = traced('boards.reorderTask', reorderTaskCommand)
export const moveTask = traced('boards.moveTask', moveTaskCommand)
export const addMember = traced('boards.addMember', addMemberCommand)
export const removeMember = traced('boards.removeMember', removeMemberCommand)
export const leaveBoard = traced('boards.leaveBoard', leaveBoardCommand)
export const transferOwnership = traced(
  'boards.transferOwnership',
  transferOwnershipCommand
)
export const archiveBoard = traced('boards.archiveBoard', archiveBoardCommand)
export const restoreBoard = traced('boards.restoreBoard', restoreBoardCommand)
export const archiveList = traced('boards.archiveList', archiveListCommand)
export const restoreList = traced('boards.restoreList', restoreListCommand)
export const archiveTask = traced('boards.archiveTask', archiveTaskCommand)
export const restoreTask = traced('boards.restoreTask', restoreTaskCommand)
export const listBoards = traced('boards.listBoards', listBoardsQuery)
export const getBoard = traced('boards.getBoard', getBoardQuery)
export const getTask = traced('boards.getTask', getTaskQuery)
export const searchUsers = traced('boards.searchUsers', searchUsersQuery)
export const roleOf = traced('boards.roleOf', roleOfQuery)

export type { AddMemberInput } from '@/modules/boards/application/commands/add-member.command'
export type { ArchiveBoardInput } from '@/modules/boards/application/commands/archive-board.command'
export type { ArchiveListInput } from '@/modules/boards/application/commands/archive-list.command'
export type { ArchiveTaskInput } from '@/modules/boards/application/commands/archive-task.command'
export type { RestoreBoardInput } from '@/modules/boards/application/commands/restore-board.command'
export type { RestoreListInput } from '@/modules/boards/application/commands/restore-list.command'
export type { RestoreTaskInput } from '@/modules/boards/application/commands/restore-task.command'
export type { View } from '@/modules/boards/application/ports/board-reader.port'
export type { CreateBoardInput } from '@/modules/boards/application/commands/create-board.command'
export type { CreateListInput } from '@/modules/boards/application/commands/create-list.command'
export type { ChangeTaskDescriptionInput } from '@/modules/boards/application/commands/change-task-description.command'
export type { CreateTaskInput } from '@/modules/boards/application/commands/create-task.command'
export type { MoveListInput } from '@/modules/boards/application/commands/move-list.command'
export type { MoveTaskInput } from '@/modules/boards/application/commands/move-task.command'
export type { LeaveBoardInput } from '@/modules/boards/application/commands/leave-board.command'
export type { RemoveMemberInput } from '@/modules/boards/application/commands/remove-member.command'
export type { RenameBoardInput } from '@/modules/boards/application/commands/rename-board.command'
export type { RenameListInput } from '@/modules/boards/application/commands/rename-list.command'
export type { RenameTaskInput } from '@/modules/boards/application/commands/rename-task.command'
export type { ReorderTaskInput } from '@/modules/boards/application/commands/reorder-task.command'
export type { TransferOwnershipInput } from '@/modules/boards/application/commands/transfer-ownership.command'
export type {
  BoardMemberDto,
  BoardSummaryDto,
} from '@/modules/boards/application/dto/board-summary.dto'
export type { BoardDto } from '@/modules/boards/application/dto/board.dto'
export type { ListDto } from '@/modules/boards/application/dto/list.dto'
export type {
  TaskDto,
  TaskSummaryDto,
} from '@/modules/boards/application/dto/task.dto'
export type { UserSearchResultDto } from '@/modules/boards/application/dto/user-search-result.dto'
export {
  AlreadyAMemberError,
  BoardArchivedError,
  BoardNameMismatchError,
  NotAMemberError,
  OwnerMustTransferFirstError,
} from '@/modules/boards/domain/board/board.errors'
export {
  ListArchivedError,
  ListHasActiveTasksError,
} from '@/modules/boards/domain/list/list.errors'
export { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
export { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
export {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
