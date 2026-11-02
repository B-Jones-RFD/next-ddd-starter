import Link from 'next/link'

/** Each settings tab is its own page under `/boards/[boardId]/settings`. */
const TABS = [
  { id: 'general', label: 'General', path: '', ownerOnly: false },
  { id: 'members', label: 'Members', path: '/members', ownerOnly: false },
  { id: 'tags', label: 'Tags', path: '/tags', ownerOnly: false },
  { id: 'log', label: 'Board log', path: '/log', ownerOnly: true },
] as const

type Tab = (typeof TABS)[number]['id']

/**
 * The board settings tabs, as links: each tab is a page, so it works before
 * hydration and the URL says which one is open. Owner-only tabs are hidden
 * from a Member; their pages refuse a Member's read anyway (§9).
 */
export function SettingsTabs({
  boardId,
  current,
  role,
}: {
  boardId: string
  current: Tab
  /** The viewer's role on the board. */
  role: 'owner' | 'member'
}) {
  return (
    <nav aria-label='Board settings'>
      <ul className='flex gap-1 border-b border-border'>
        {TABS.filter((tab) => role === 'owner' || !tab.ownerOnly).map((tab) => (
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
