import Link from 'next/link'

/** Each settings tab is its own page under `/boards/[boardId]/settings`. */
const TABS = [
  { id: 'general', label: 'General', path: '' },
  { id: 'members', label: 'Members', path: '/members' },
] as const

type Tab = (typeof TABS)[number]['id']

/**
 * The board settings tabs, as links: each tab is a page, so it works before
 * hydration and the URL says which one is open.
 */
export function SettingsTabs({
  boardId,
  current,
}: {
  boardId: string
  current: Tab
}) {
  return (
    <nav aria-label='Board settings'>
      <ul className='flex gap-1 border-b border-border'>
        {TABS.map((tab) => (
          <li key={tab.id}>
            <Link
              href={`/boards/${boardId}/settings${tab.path}`}
              aria-current={tab.id === current ? 'page' : undefined}
              className='-mb-px inline-flex h-10 items-center rounded-t-md border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:border-foreground aria-[current=page]:text-foreground'
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
