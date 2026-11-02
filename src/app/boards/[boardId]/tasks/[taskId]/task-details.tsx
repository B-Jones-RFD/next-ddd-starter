import { Suspense } from 'react'

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
 * sections, each in its own `<Suspense>`, with Activity last.
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
      <p className='text-sm text-muted-foreground'>
        {task.boardName} · in {task.listName}
      </p>
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
