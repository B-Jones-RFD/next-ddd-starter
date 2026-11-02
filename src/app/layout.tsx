import { cn } from 'cn'
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter } from 'next/font/google'
import Link from 'next/link'

import { ThemeSync } from '@/app/_components/theme-sync'
import { themeScript } from '@/app/_lib/theme/theme'

import './globals.css'

const interHeading = Inter({ subsets: ['latin'], variable: '--font-heading' })

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: { default: 'Task Board', template: '%s · Task Board' },
  description: 'Organize work as tasks on shared boards.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The inline script sets `data-theme` before React hydrates (ADR 0018).
    <html
      lang='en'
      suppressHydrationWarning
      className={cn(
        'h-full',
        'antialiased',
        geistSans.variable,
        geistMono.variable,
        interHeading.variable
      )}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className='flex min-h-full flex-col'>
        <ThemeSync />
        <header className='border-b border-border'>
          <div className='mx-auto flex h-14 w-full max-w-6xl items-center px-4'>
            <Link
              href='/'
              className='rounded-sm font-heading font-semibold text-foreground'
            >
              Task Board
            </Link>
          </div>
        </header>
        <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8'>
          {children}
        </main>
      </body>
    </html>
  )
}
