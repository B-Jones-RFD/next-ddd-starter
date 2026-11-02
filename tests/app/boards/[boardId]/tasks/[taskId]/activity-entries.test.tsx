import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ActionState } from '@/app/_lib/actions/action-state'
import { addCommentAction } from '@/app/boards/[boardId]/tasks/[taskId]/actions'
import { ActivityEntries } from '@/app/boards/[boardId]/tasks/[taskId]/activity-entries'

vi.mock('@/app/boards/[boardId]/tasks/[taskId]/actions', () => ({
  addCommentAction: vi.fn(),
}))

const post = vi.mocked(addCommentAction)

/** Makes the next post wait until `settle` is called with its result. */
function postWaits() {
  let settle: (state: ActionState) => void = () => {}
  post.mockImplementationOnce(
    () =>
      new Promise<ActionState>((resolve) => {
        settle = resolve
      })
  )
  return (state: ActionState) => act(async () => settle(state))
}

function renderActivity() {
  render(
    <ActivityEntries
      boardId='board-1'
      taskId='task-1'
      authorName='Ben'
      hasEntries
    >
      <li>Ada created the task in “Backlog”</li>
    </ActivityEntries>
  )
  return {
    box: screen.getByLabelText('Comment') as HTMLTextAreaElement,
    list: screen.getByRole('list'),
  }
}

async function submit(box: HTMLTextAreaElement, text: string) {
  fireEvent.change(box, { target: { value: text } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  })
}

beforeEach(() => {
  post.mockReset()
})

describe('ActivityEntries', () => {
  it('shows a posted comment at the top of Activity at once, by its author, and empties the box', async () => {
    const settle = postWaits()
    const { box, list } = renderActivity()

    await submit(box, 'Can we keep it to one page?')

    const [first, second] = within(list).getAllByRole('listitem')
    expect(first?.textContent).toContain('Ben')
    expect(first?.textContent).toContain('Can we keep it to one page?')
    expect(second?.textContent).toContain('Ada created the task')
    expect(box.value).toBe('')
    expect(post).toHaveBeenCalledWith(
      'board-1',
      'task-1',
      { status: 'idle' },
      expect.any(FormData)
    )
    expect((post.mock.calls[0]?.[3] as FormData).get('text')).toBe(
      'Can we keep it to one page?'
    )
    await settle({ status: 'success' })
  })

  it('says “Comment posted” in a status once the post succeeds', async () => {
    const settle = postWaits()
    const { box } = renderActivity()

    await submit(box, 'Done')
    expect(screen.getByRole('status').textContent).toBe('')
    await settle({ status: 'success' })

    expect(screen.getByRole('status').textContent).toBe('Comment posted')
  })

  it('takes a failed comment back out of Activity and puts its text back in the box, with the error', async () => {
    const settle = postWaits()
    const { box, list } = renderActivity()

    await submit(box, 'a'.repeat(2001))
    await settle({
      status: 'error',
      error: {
        code: 'validation',
        message: 'Check the fields below.',
        fields: { text: 'Use 2000 characters or fewer.' },
      },
      values: { text: 'a'.repeat(2001) },
    })

    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(box.value).toBe('a'.repeat(2001))
    expect(screen.getByText('Use 2000 characters or fewer.')).toBeTruthy()
    expect(box.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('shows a failure that isn’t about the text in an alert', async () => {
    const settle = postWaits()
    const { box } = renderActivity()

    await submit(box, 'Hello')
    await settle({
      status: 'error',
      error: {
        code: 'boards.task.archived',
        message: 'That task was archived, so it can’t be changed.',
      },
      values: { text: 'Hello' },
    })

    expect(screen.getByRole('alert').textContent).toContain(
      'That task was archived'
    )
    expect(box.value).toBe('Hello')
  })

  it('says there is no activity when there are no entries and nothing posted', () => {
    render(
      <ActivityEntries
        boardId='board-1'
        taskId='task-1'
        authorName='Ben'
        hasEntries={false}
      />
    )

    expect(screen.getByText('No activity yet.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })
})
