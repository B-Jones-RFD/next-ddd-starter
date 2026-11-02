import { cn } from 'cn'
import type { ComponentProps } from 'react'

function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    // The caller passes `htmlFor`.
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      data-slot='label'
      className={cn('text-sm leading-none font-medium select-none', className)}
      {...props}
    />
  )
}

export { Label }
