import { Crown } from 'lucide-react'

import type { BoardMemberDto } from '@/modules/boards/api'

/** How a member is named when boards hasn't learned their display name yet. */
const UNKNOWN = 'Unknown member'

function nameOf(member: BoardMemberDto): string {
  return member.displayName ?? UNKNOWN
}

/**
 * A board's members as one element named by them ("Members: Ada (Owner),
 * Ben"), with each avatar hidden from assistive technology (§10). The Owner
 * gets a crown as well as "(Owner)", so the role never relies on the icon.
 */
export function AvatarStack({ members }: { members: BoardMemberDto[] }) {
  const label = `Members: ${members
    .map((m) => (m.role === 'owner' ? `${nameOf(m)} (Owner)` : nameOf(m)))
    .join(', ')}`

  return (
    <div role='img' aria-label={label} className='flex -space-x-2'>
      {members.map((member) => (
        <span
          key={member.userId}
          aria-hidden
          title={nameOf(member)}
          className='relative flex size-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-sm font-medium text-secondary-foreground'
        >
          {nameOf(member).trim().charAt(0).toUpperCase() || '?'}
          {member.role === 'owner' && (
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
