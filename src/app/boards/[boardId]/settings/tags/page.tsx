import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { TagBadge } from '@/app/_components/tags/tag-badge'
import { requireActor } from '@/app/_lib/auth/get-actor'
import { SettingsTabs } from '@/app/boards/[boardId]/settings/settings-tabs'
import {
  CreateTagForm,
  DeleteTagForm,
  EditTagDialog,
} from '@/app/boards/[boardId]/settings/tags/tag-forms'
import { TAGS_HEADING_ID } from '@/app/boards/[boardId]/settings/tags/tags-heading'
import { getBoard, listTags } from '@/modules/boards/api'

export const metadata: Metadata = { title: 'Board tags' }

type Props = PageProps<'/boards/[boardId]/settings/tags'>

export default function BoardTagsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <p role='status' className='text-muted-foreground'>
          Loading tags…
        </p>
      }
    >
      <Tags params={params} />
    </Suspense>
  )
}

/**
 * The Tags tab. Any Board member defines, renames, recolors and deletes the
 * board's tags. Deleting one strips it from its tasks as a Consequence.
 */
async function Tags({ params }: Pick<Props, 'params'>) {
  const { boardId } = await params
  const actor = await requireActor(`/boards/${boardId}/settings/tags`)
  const board = await getBoard({ actorId: actor.userId, boardId })
  if (!board.ok) notFound()
  const tags = await listTags({ actorId: actor.userId, boardId })
  if (!tags.ok) notFound()
  const { id, name, archived } = board.value

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
      <SettingsTabs boardId={id} current='tags' role={board.value.role} />
      <section
        aria-labelledby={TAGS_HEADING_ID}
        className='flex max-w-2xl flex-col gap-4'
      >
        <h2
          id={TAGS_HEADING_ID}
          tabIndex={-1}
          className='font-heading text-lg font-semibold outline-none'
        >
          Tags
        </h2>
        {tags.value.length === 0 ? (
          <p className='text-muted-foreground'>This board has no tags yet.</p>
        ) : (
          <ul className='flex flex-col divide-y divide-border rounded-xl border border-border'>
            {tags.value.map((tag) => (
              <li
                key={tag.id}
                className='flex flex-wrap items-center justify-between gap-3 p-3'
              >
                <TagBadge tag={tag} className='text-sm' />
                {!archived && (
                  <div className='flex flex-wrap items-start justify-end gap-2'>
                    <EditTagDialog boardId={id} tag={tag} />
                    <DeleteTagForm boardId={id} tag={tag} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className='text-sm text-muted-foreground'>
          {archived
            ? 'The board is archived, so its tags can’t change.'
            : 'Deleting a tag removes it from every task that has it.'}
        </p>
      </section>
      {!archived && (
        <section
          aria-labelledby='new-tag-heading'
          className='flex max-w-2xl flex-col gap-4'
        >
          <h2
            id='new-tag-heading'
            className='font-heading text-lg font-semibold'
          >
            New tag
          </h2>
          <CreateTagForm key={tags.value.length} boardId={id} />
        </section>
      )}
    </div>
  )
}
