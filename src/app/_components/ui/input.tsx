import { cn } from 'cn'
import type { ComponentProps } from 'react'

// The input border uses `--muted-foreground` so the field itself meets 3:1
// against the background in both themes (§10).
function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot='input'
      className={cn(
        'h-9 w-full min-w-0 rounded-lg border border-muted-foreground bg-background px-2.5 py-1 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive md:text-sm',
        className
      )}
      {...props}
    />
  )
}

export { Input }
