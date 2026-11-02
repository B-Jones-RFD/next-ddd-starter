import { cn } from 'cn'
import type { ComponentProps } from 'react'

// A native select, styled like `Input` (§10). The platform gives it keyboard
// and screen-reader support, and a full-screen picker on phones.
function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot='select'
      className={cn(
        'h-9 w-full min-w-0 rounded-lg border border-muted-foreground bg-background px-2 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 md:text-sm',
        className
      )}
      {...props}
    />
  )
}

export { Select }
