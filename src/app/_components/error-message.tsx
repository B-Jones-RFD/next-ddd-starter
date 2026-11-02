'use client'

import { Button } from '@/app/_components/ui/button'

type Props = {
  error: unknown
  retry: () => void
}

/**
 * The body of `error.tsx` and `global-error.tsx`. It shows `error.digest` as
 * the reference, so a user's report finds the server-side failure in the logs.
 */
export function ErrorMessage({ error, retry }: Props) {
  const digest =
    error instanceof Error &&
    'digest' in error &&
    typeof error.digest === 'string'
      ? error.digest
      : undefined

  return (
    <div className='flex flex-col items-start gap-4'>
      <h1 className='font-heading text-2xl font-semibold'>
        Something went wrong
      </h1>
      <p className='text-muted-foreground'>
        Try again. If it keeps happening, report it with the reference below.
      </p>
      {digest && (
        <p>
          Reference: <code className='font-mono'>{digest}</code>
        </p>
      )}
      <Button onClick={retry}>Try again</Button>
    </div>
  )
}
