import 'server-only'

import { getActivity as getActivityQuery } from '@/modules/audit/application/queries/get-activity.query'
import { traced } from '@/shared/infrastructure/tracing'

// Public API of the audit context (§2): its queries, each wrapped in
// `traced`, plus their DTO types and the errors they return.

export const getActivity = traced('audit.getActivity', getActivityQuery)

export type { GetActivityInput } from '@/modules/audit/application/queries/get-activity.query'
export type {
  ActivityEntryDto,
  ActivityPageDto,
  AuditEntryDto,
} from '@/modules/audit/application/dto/activity.dto'
export {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
