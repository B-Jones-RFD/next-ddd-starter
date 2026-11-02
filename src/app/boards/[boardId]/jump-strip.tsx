'use client'

import { listHeadingId } from '@/app/boards/[boardId]/list-places'

/**
 * On narrow screens, one button per list that scrolls its column into view
 * and focuses its heading (§10). Under reduced motion the scroll is instant.
 */
export function JumpStrip({
  lists,
}: {
  lists: { id: string; name: string }[]
}) {
  function jumpTo(listId: string) {
    const heading = document.getElementById(listHeadingId(listId))
    if (!heading) return
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    heading.closest('section')?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'start',
    })
    heading.focus({ preventScroll: true })
  }

  return (
    <nav aria-label='Lists' className='sm:hidden'>
      <ul className='-mx-4 flex gap-2 overflow-x-auto px-4 pb-1'>
        {lists.map((list) => (
          <li key={list.id} className='shrink-0'>
            <button
              type='button'
              onClick={() => jumpTo(list.id)}
              className='min-h-8 max-w-48 truncate rounded-full border border-border bg-card px-3 text-sm text-card-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring'
            >
              {list.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
