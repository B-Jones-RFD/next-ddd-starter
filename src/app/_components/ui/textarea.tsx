import { cn } from 'cn'
import type { ComponentProps } from 'react'

// Styled like `Input`: the border uses `--muted-foreground` for 3:1 (§10).
function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot='textarea'
      className={cn(
        'min-h-24 w-full min-w-0 rounded-lg border border-muted-foreground bg-background px-2.5 py-2 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive md:text-sm',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
