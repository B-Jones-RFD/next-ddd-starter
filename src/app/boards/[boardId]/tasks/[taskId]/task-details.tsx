import { Suspense } from 'react'

import { ArchivedBadge } from '@/app/_components/archived-badge'
import { TagBadge } from '@/app/_components/tags/tag-badge'
import { assigneesHeadingId } from '@/app/boards/[boardId]/task-places'
import { AssigneeForms } from '@/app/boards/[boardId]/tasks/[taskId]/assignee-forms'
import { TaskActivity } from '@/app/boards/[boardId]/tasks/[taskId]/task-activity'
import {
  TaskDescriptionForm,
  TaskTitleForm,
} from '@/app/boards/[boardId]/tasks/[taskId]/task-forms'
import { TaskTags } from '@/app/boards/[boardId]/tasks/[taskId]/task-tags'
import { getBoard, type TaskDto } from '@/modules/boards/api'
import type { ActorDto } from '@/modules/identity/api'

/**
 * The task's body, shared by its dialog and its page, under the heading
 * each gives it: where it sits, its title and description forms, then its
 * sections, each in its own `<Suspense>`, with Activity last. An archived
 * task, or any task on an archived board, is read-only: it shows its
 * description, assignees and tags instead of their forms.
 */
export function TaskDetails({
  task,
  actorId,
  searchParams,
}: {
  task: TaskDto
  /** The reader. It also keys the forms, so a sign-out never leaves half-typed text. */
  actorId: ActorDto['userId']
  /** The route's query, which pages the Activity. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-center gap-2'>
        {task.archived && <ArchivedBadge />}
        <p className='text-sm text-muted-foreground'>
          {task.boardName} · in {task.listName}
        </p>
      </div>
      {task.archived || task.boardArchived ? (
        <ReadOnlyTask task={task} />
      ) : (
        <>
          <TaskTitleForm
            key={`${actorId}-title`}
            boardId={task.boardId}
            task={task}
          />
          <TaskDescriptionForm
            key={`${actorId}-description`}
            boardId={task.boardId}
            task={task}
          />
          <section
            aria-labelledby={assigneesHeadingId(task.id)}
            className='flex flex-col gap-3'
          >
            {/* Focusable only by script: focus lands here after an unassign. */}
            <h2
              id={assigneesHeadingId(task.id)}
              tabIndex={-1}
              className='rounded-sm font-heading text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring'
            >
              Assignees
            </h2>
            <Suspense
              fallback={
                <p role='status' className='text-sm text-muted-foreground'>
                  Loading assignees…
                </p>
              }
            >
              <Assignees key={actorId} task={task} actorId={actorId} />
            </Suspense>
          </section>
          <Suspense
            fallback={
              <p className='text-sm text-muted-foreground'>Loading tags…</p>
            }
          >
            <TaskTags task={task} />
          </Suspense>
        </>
      )}
      <Suspense
        fallback={
          <p className='text-sm text-muted-foreground'>Loading activity…</p>
        }
      >
        <TaskActivity
          boardId={task.boardId}
          taskId={task.id}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  )
}

/** What an archived task, or a task on an archived board, shows instead. */
function ReadOnlyTask({ task }: { task: TaskDto }) {
  return (
    <>
      <p className='text-sm'>
        {task.archived
          ? 'This task is archived, so it’s read-only. Restore it from the board’s Archived view to change it.'
          : 'This board is archived, so its tasks are read-only.'}
      </p>
      <section aria-labelledby={`task-${task.id}-description-heading`}>
        <h2
          id={`task-${task.id}-description-heading`}
          className='font-heading text-lg font-semibold'
        >
          Description
        </h2>
        <p className='mt-1.5 text-sm break-words whitespace-pre-wrap text-muted-foreground'>
          {task.description || 'No description.'}
        </p>
      </section>
      <section aria-labelledby={assigneesHeadingId(task.id)}>
        <h2
          id={assigneesHeadingId(task.id)}
          className='font-heading text-lg font-semibold'
        >
          Assignees
        </h2>
        {task.assignees.length === 0 ? (
          <p className='mt-1.5 text-sm text-muted-foreground'>
            No one is assigned.
          </p>
        ) : (
          <ul className='mt-1.5 flex flex-col gap-1 text-sm'>
            {task.assignees.map((assignee) => (
              <li key={assignee.userId}>{assignee.displayName ?? 'Someone'}</li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={`task-${task.id}-tags-heading`}>
        <h2
          id={`task-${task.id}-tags-heading`}
          className='font-heading text-lg font-semibold'
        >
          Tags
        </h2>
        {task.tags.length === 0 ? (
          <p className='mt-1.5 text-sm text-muted-foreground'>No tags.</p>
        ) : (
          <ul className='mt-1.5 flex flex-wrap gap-1'>
            {task.tags.map((tag) => (
              <li key={tag.id}>
                <TagBadge tag={tag} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/** The assignee picker, offering the board's members. */
async function Assignees({
  task,
  actorId,
}: {
  task: TaskDto
  actorId: ActorDto['userId']
}) {
  const board = await getBoard({ actorId, boardId: task.boardId })
  // The task's read already proved membership; a board gone since shows nothing.
  if (!board.ok) return null

  return (
    <AssigneeForms
      boardId={task.boardId}
      taskId={task.id}
      assignees={task.assignees}
      members={board.value.members}
    />
  )
}
