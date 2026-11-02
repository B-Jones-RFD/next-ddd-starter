import { Crown } from 'lucide-react'
import type { Metadata } from 'next'
import Form from 'next/form'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { AvatarStack } from '@/app/_components/avatar-stack'
import { Field } from '@/app/_components/form/field'
import { Button } from '@/app/_components/ui/button'
import { requireActor } from '@/app/_lib/auth/get-actor'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import {
  AddMemberForm,
  LeaveBoardForm,
  MEMBERS_HEADING_ID,
  MemberControls,
} from '@/app/boards/[boardId]/settings/members/member-forms'
import { SettingsTabs } from '@/app/boards/[boardId]/settings/settings-tabs'
import {
  getBoard,
  searchUsers,
  type BoardDto,
  type BoardMemberDto,
} from '@/modules/boards/api'
import type { ActorDto } from '@/modules/identity/api'

export const metadata: Metadata = { title: 'Board members' }

type Props = PageProps<'/boards/[boardId]/settings/members'>

export default function BoardMembersPage({ params, searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <p role='status' className='text-muted-foreground'>
          Loading board members…
        </p>
      }
    >
      <Members params={params} searchParams={searchParams} />
    </Suspense>
  )
}

const nameOf = (member: BoardMemberDto) =>
  member.displayName ?? 'Unknown member'

/**
 * The Members tab. Everyone sees who is on the board. The Owner can add,
 * remove and transfer ownership; a Member can leave. The UI only hides what
 * the viewer may not do: the domain checks every command again (§9).
 */
async function Members({ params, searchParams }: Props) {
  const { boardId } = await params
  const path = `/boards/${boardId}/settings/members`
  const actor = await requireActor(path)
  const board = await getBoard({ actorId: actor.userId, boardId })
  if (!board.ok) notFound()
  const { id, name, role, members } = board.value
  const isOwner = role === 'owner'
  const { email } = await searchParams

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <Link
          href={`/boards/${id}`}
          className='self-start rounded-sm text-sm font-medium text-foreground underline underline-offset-4'
        >
          Back to {name}
        </Link>
        <h1 className='font-heading text-2xl font-semibold'>Board settings</h1>
      </div>
      <SettingsTabs boardId={id} current='members' role={role} />
      <section
        aria-labelledby={MEMBERS_HEADING_ID}
        className='flex max-w-2xl flex-col gap-4'
      >
        <h2
          id={MEMBERS_HEADING_ID}
          tabIndex={-1}
          className='font-heading text-lg font-semibold outline-none'
        >
          Members
        </h2>
        <AvatarStack people={members} />
        <ul className='flex flex-col divide-y divide-border rounded-xl border border-border'>
          {members.map((member) => (
            <li
              key={member.userId}
              className='flex flex-wrap items-center justify-between gap-3 p-3'
            >
              <span className='flex items-center gap-2 break-words'>
                {nameOf(member)}
                {member.userId === actor.userId && (
                  <span className='text-muted-foreground'>(you)</span>
                )}
                {member.role === 'owner' && (
                  <span className='inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs font-medium'>
                    <Crown aria-hidden className='size-3 fill-current' />
                    Owner
                  </span>
                )}
              </span>
              {isOwner && member.role === 'member' && (
                <MemberControls
                  boardId={id}
                  userId={member.userId}
                  name={nameOf(member)}
                />
              )}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <p className='text-sm text-muted-foreground'>
            To leave this board, transfer ownership to another member first.
          </p>
        ) : (
          <div className='flex flex-col items-start gap-2'>
            <p className='text-sm text-muted-foreground'>
              Only the board’s Owner can add or remove members.
            </p>
            <LeaveBoardForm boardId={id} />
          </div>
        )}
      </section>
      {isOwner && (
        <AddMember
          board={board.value}
          path={path}
          actorId={actor.userId}
          email={typeof email === 'string' ? email : undefined}
        />
      )}
    </div>
  )
}

/**
 * The Owner's search for a registered user by email. It is a GET form, so
 * the search is in the URL and works before hydration.
 */
async function AddMember({
  board,
  path,
  actorId,
  email,
}: {
  board: BoardDto
  path: string
  actorId: ActorDto['userId']
  email: string | undefined
}) {
  const found =
    email === undefined
      ? undefined
      : await searchUsers({
          actorId,
          boardId: board.id,
          email,
        })
  // The Owner's own read just passed, so anything but a field error means
  // the board changed under them.
  if (found && !found.ok && found.error.code !== 'validation') notFound()
  const fieldError =
    found && !found.ok ? toActionError(found.error).fields?.email : undefined

  return (
    <section
      aria-labelledby='add-member-heading'
      className='flex max-w-2xl flex-col gap-4'
    >
      <h2
        id='add-member-heading'
        className='font-heading text-lg font-semibold'
      >
        Add a member
      </h2>
      <p className='text-sm text-muted-foreground'>
        Find someone who has an account by the email they registered with.
      </p>
      <Form action={path} className='flex flex-col gap-4' role='search'>
        <Field
          name='email'
          label='Email address'
          type='email'
          autoComplete='off'
          required
          defaultValue={email}
          error={fieldError}
        />
        <Button type='submit' size='lg' className='self-start'>
          Search
        </Button>
      </Form>
      {found?.ok &&
        (found.value.length === 0 ? (
          <p>Nobody has registered with that email.</p>
        ) : (
          <ul className='flex flex-col divide-y divide-border rounded-xl border border-border'>
            {found.value.map((user) => (
              <li
                key={user.userId}
                className='flex flex-wrap items-center justify-between gap-3 p-3'
              >
                <span className='break-words'>
                  {user.displayName}{' '}
                  <span className='text-muted-foreground'>({user.email})</span>
                </span>
                {user.isMember ? (
                  <span className='text-sm text-muted-foreground'>
                    Already a member
                  </span>
                ) : (
                  <AddMemberForm
                    boardId={board.id}
                    userId={user.userId}
                    name={user.displayName}
                  />
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
