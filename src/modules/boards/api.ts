import 'server-only'

import { createBoard as createBoardCommand } from '@/modules/boards/application/commands/create-board.command'
import { createList as createListCommand } from '@/modules/boards/application/commands/create-list.command'
import { moveList as moveListCommand } from '@/modules/boards/application/commands/move-list.command'
import { renameBoard as renameBoardCommand } from '@/modules/boards/application/commands/rename-board.command'
import { renameList as renameListCommand } from '@/modules/boards/application/commands/rename-list.command'
import { getBoard as getBoardQuery } from '@/modules/boards/application/queries/get-board.query'
import { listBoards as listBoardsQuery } from '@/modules/boards/application/queries/list-boards.query'
import { traced } from '@/shared/infrastructure/tracing'

// Public API of the boards context (§2): its commands and queries, each
// wrapped in `traced`, plus their DTO types and the errors they return.

export const createBoard = traced('boards.createBoard', createBoardCommand)
export const renameBoard = traced('boards.renameBoard', renameBoardCommand)
export const createList = traced('boards.createList', createListCommand)
export const renameList = traced('boards.renameList', renameListCommand)
export const moveList = traced('boards.moveList', moveListCommand)
export const listBoards = traced('boards.listBoards', listBoardsQuery)
export const getBoard = traced('boards.getBoard', getBoardQuery)

export type { CreateBoardInput } from '@/modules/boards/application/commands/create-board.command'
export type { CreateListInput } from '@/modules/boards/application/commands/create-list.command'
export type { MoveListInput } from '@/modules/boards/application/commands/move-list.command'
export type { RenameBoardInput } from '@/modules/boards/application/commands/rename-board.command'
export type { RenameListInput } from '@/modules/boards/application/commands/rename-list.command'
export type {
  BoardMemberDto,
  BoardSummaryDto,
} from '@/modules/boards/application/dto/board-summary.dto'
export type { BoardDto } from '@/modules/boards/application/dto/board.dto'
export type { ListDto } from '@/modules/boards/application/dto/list.dto'
export { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
export {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
