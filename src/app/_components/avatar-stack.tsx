import { Crown } from 'lucide-react'

import { cn } from '@/app/_components/lib/utils'
import type { AssigneeDto, BoardMemberDto } from '@/modules/boards/api'

/** How a person is named when boards hasn't learned their display name yet. */
const UNKNOWN = 'Unknown member'

type Person = AssigneeDto & { role?: BoardMemberDto['role'] }

function nameOf(person: Person): string {
  return person.displayName ?? UNKNOWN
}

/**
 * People as one element named by them ("Members: Ada (Owner), Ben", or
 * "Assignees: Ben, Ada"), with each avatar hidden from assistive technology
 * (§10). An Owner gets a crown as well as "(Owner)", so the role never
 * relies on the icon.
 */
export function AvatarStack({
  label = 'Members',
  people,
  size = 'default',
}: {
  /** What the people are, leading the accessible name. */
  label?: string
  people: Person[]
  size?: 'default' | 'sm'
}) {
  const name = `${label}: ${people
    .map((p) => (p.role === 'owner' ? `${nameOf(p)} (Owner)` : nameOf(p)))
    .join(', ')}`

  return (
    <div role='img' aria-label={name} className='flex -space-x-2'>
      {people.map((person) => (
        <span
          key={person.userId}
          aria-hidden
          title={nameOf(person)}
          className={cn(
            'relative flex items-center justify-center rounded-full border-2 border-card bg-secondary font-medium text-secondary-foreground',
            size === 'sm' ? 'size-6 text-xs' : 'size-8 text-sm'
          )}
        >
          {nameOf(person).trim().charAt(0).toUpperCase() || '?'}
          {person.role === 'owner' && (
            <Crown
              aria-hidden
              className='absolute -top-2 -right-1 size-3.5 fill-current text-foreground'
            />
          )}
        </span>
      ))}
    </div>
  )
}
