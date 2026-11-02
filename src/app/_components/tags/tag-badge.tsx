import type { ReactNode } from 'react'

import { cn } from '@/app/_components/lib/utils'
import {
  TAG_COLOR_STYLES,
  type TagColorName,
} from '@/app/_components/tags/tag-colors'

/**
 * A tag as a chip: always its name, on its Tag color, so color is never the
 * only signal (§10). `children` sits after the name, for a remove button.
 */
export function TagBadge({
  tag,
  className,
  children,
}: {
  tag: { name: string; color: TagColorName }
  className?: string
  children?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium break-words',
        TAG_COLOR_STYLES[tag.color].className,
        className
      )}
    >
      {tag.name}
      {children}
    </span>
  )
}
