'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/app/_components/ui/button'

/** Submits its form, and is disabled while the form is pending (§10). */
export function SubmitButton({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type='submit'
      size='lg'
      disabled={pending}
      aria-disabled={pending}
      className={className}
    >
      {children}
    </Button>
  )
}
