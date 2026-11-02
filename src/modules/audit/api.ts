import 'server-only'

import { getActivity as getActivityQuery } from '@/modules/audit/application/queries/get-activity.query'
import { getBoardLog as getBoardLogQuery } from '@/modules/audit/application/queries/get-board-log.query'
import { getUserLog as getUserLogQuery } from '@/modules/audit/application/queries/get-user-log.query'
import { traced } from '@/shared/infrastructure/tracing'

// Public API of the audit context (§2): its queries, each wrapped in
// `traced`, plus their DTO types and the errors they return.

export const getActivity = traced('audit.getActivity', getActivityQuery)
export const getBoardLog = traced('audit.getBoardLog', getBoardLogQuery)
export const getUserLog = traced('audit.getUserLog', getUserLogQuery)

export type { GetActivityInput } from '@/modules/audit/application/queries/get-activity.query'
export type { GetBoardLogInput } from '@/modules/audit/application/queries/get-board-log.query'
export type { GetUserLogInput } from '@/modules/audit/application/queries/get-user-log.query'
export type {
  ActivityEntryDto,
  ActivityPageDto,
  AuditEntryDto,
  LogEntryDto,
  LogPageDto,
} from '@/modules/audit/application/dto/activity.dto'
export {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
