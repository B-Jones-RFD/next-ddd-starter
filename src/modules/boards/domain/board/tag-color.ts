import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/**
 * The fixed palette every tag takes its color from (§10). The domain stores
 * only the name: `app/` maps it to its theme tokens.
 */
export const TAG_COLORS = [
  'gray',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'violet',
] as const

/** One of the named colors in `TAG_COLORS`. */
export type TagColor = (typeof TAG_COLORS)[number]

/** Requires one of the palette's names, exactly. */
export function parseTagColor(raw: string): Result<TagColor, ValidationError> {
  const color = TAG_COLORS.find((name) => name === raw)
  return color ? ok(color) : err(new ValidationError({ color: 'invalid' }))
}
