import 'server-only'

import { listBoards as listBoardsQuery } from '@/modules/boards/application/queries/list-boards.query'
import { traced } from '@/shared/infrastructure/tracing'

// Public API of the boards context (§2): its commands and queries, each
// wrapped in `traced`, plus their DTO types and the errors they return.

export const listBoards = traced('boards.listBoards', listBoardsQuery)

export type { BoardSummaryDto } from '@/modules/boards/application/dto/board-summary.dto'
export { ValidationError } from '@/shared/kernel/errors/domain-error'
