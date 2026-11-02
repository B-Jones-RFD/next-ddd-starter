import { CircleAlert } from 'lucide-react'

import type { ActionError } from '@/app/_lib/errors/action-error'

/**
 * A form's one alert for everything that isn't a field error (§10). It is
 * `role="alert"`, so a failure is announced. Successes get none.
 */
export function FormAlert({ error }: { error?: ActionError }) {
  if (!error) return null
  return (
    <div
      role='alert'
      className='flex items-start gap-2 rounded-lg border border-destructive p-3 text-sm text-destructive'
    >
      <CircleAlert aria-hidden className='mt-0.5 size-4 shrink-0' />
      <div className='flex flex-col gap-1'>
        <p>{error.message}</p>
        {error.reference && (
          <p>
            Reference: <code className='font-mono'>{error.reference}</code>
          </p>
        )}
      </div>
    </div>
  )
}
