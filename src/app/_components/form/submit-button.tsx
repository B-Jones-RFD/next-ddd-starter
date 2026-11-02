'use client'

import type { ComponentProps, ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/app/_components/ui/button'

/** Submits its form, and is disabled while the form is pending (§10). */
export function SubmitButton({
  children,
  className,
  variant,
}: {
  children: ReactNode
  className?: string
  variant?: ComponentProps<typeof Button>['variant']
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type='submit'
      size='lg'
      variant={variant}
      disabled={pending}
      aria-disabled={pending}
      className={className}
    >
      {children}
    </Button>
  )
}
