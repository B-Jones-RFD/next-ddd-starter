import { CircleAlert } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Input } from '@/app/_components/ui/input'
import { Label } from '@/app/_components/ui/label'

type FieldProps = Omit<ComponentProps<'input'>, 'id' | 'name'> & {
  name: string
  label: string
  /** Defaults to `field-<name>`. Set it where two forms share a field name. */
  id?: string
  /** The field's error, shown under it and linked by `aria-describedby`. */
  error?: string
}

/** A labelled input with its error under it (§10). */
export function Field({
  name,
  label,
  error,
  id = `field-${name}`,
  ...input
}: FieldProps) {
  const errorId = `${id}-error`
  return (
    <div className='flex flex-col gap-1.5'>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
      />
      <FieldError id={errorId} message={error} />
    </div>
  )
}

/** A field's error text with an icon, so it never relies on color alone. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className='flex items-start gap-1.5 text-sm text-destructive'>
      <CircleAlert aria-hidden className='mt-0.5 size-4 shrink-0' />
      <span>{message}</span>
    </p>
  )
}
