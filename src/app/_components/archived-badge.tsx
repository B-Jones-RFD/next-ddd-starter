import { cn } from 'cn'

/**
 * The text badge on an archived board, list or task. Its state is said in
 * words, never only by color (§10).
 */
export function ArchivedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground',
        className
      )}
    >
      Archived
    </span>
  )
}
