'use client'

import { ErrorMessage } from '@/app/_components/error-message'

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  return <ErrorMessage error={error} retry={retry} />
}
