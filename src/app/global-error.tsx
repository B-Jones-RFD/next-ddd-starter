'use client'

import { ErrorMessage } from '@/app/_components/error-message'
import { ThemeSync } from '@/app/_components/theme-sync'

import './globals.css'

// Replaces the root layout when it fails, so it brings its own document,
// styles and theme. With no inline script here, `ThemeSync` applies an
// explicit choice, and System still follows `prefers-color-scheme` in CSS.
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  return (
    <html lang='en' suppressHydrationWarning className='h-full antialiased'>
      <body className='flex min-h-full flex-col'>
        <title>Something went wrong · Task Board</title>
        <ThemeSync />
        <header className='border-b border-border'>
          <div className='mx-auto flex h-14 w-full max-w-6xl items-center px-4 font-heading font-semibold'>
            Task Board
          </div>
        </header>
        <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8'>
          <ErrorMessage error={error} retry={retry} />
        </main>
      </body>
    </html>
  )
}
