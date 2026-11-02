import { expect, test } from '@playwright/test'

import {
  addListNamed,
  addTaskNamed,
  createBoardNamed,
  signUp,
} from '@tests/fixtures/visitors'

test('a Board member archives tasks, finds them in the Archived view, and restores one to its old place', async ({
  page,
}) => {
  await signUp(page)
  const boardPath = await createBoardNamed(page, 'Launch plan')
  await addListNamed(page, 'Backlog')
  await addListNamed(page, 'Done')
  await addTaskNamed(page, 'Backlog', 'Write the brief')
  await addTaskNamed(page, 'Backlog', 'Book the venue')
  await addTaskNamed(page, 'Done', 'Pick the date')
  const backlog = page.getByRole('region', { name: 'Backlog', exact: true })
  const done = page.getByRole('region', { name: 'Done', exact: true })

  // Archiving hides the task, and focus moves to the next task's ⋯.
  await backlog
    .getByRole('button', { name: 'Actions for task Write the brief' })
    .click()
  await page.getByRole('menuitem', { name: 'Archive task' }).click()
  await expect(backlog.getByRole('heading', { level: 3 })).toHaveText([
    'Book the venue',
  ])
  await expect(
    backlog.getByRole('button', { name: 'Actions for task Book the venue' })
  ).toBeFocused()

  // With no next task, focus moves to the column heading.
  await backlog
    .getByRole('button', { name: 'Actions for task Book the venue' })
    .click()
  await page.getByRole('menuitem', { name: 'Archive task' }).click()
  await expect(backlog.getByRole('heading', { level: 3 })).toHaveCount(0)
  await expect(
    backlog.getByRole('heading', { level: 2, name: 'Backlog' })
  ).toBeFocused()

  // A list with an active task can't be archived, and says why.
  await done.getByRole('button', { name: 'Actions for list Done' }).click()
  await page.getByRole('menuitem', { name: 'Archive list' }).click()
  await expect(
    done
      .getByRole('alert')
      .filter({ hasText: 'This list still has active tasks.' })
  ).toBeVisible()

  // The Archived view shows the archived tasks, each with a text badge.
  await page
    .getByRole('navigation', { name: 'Board view' })
    .getByRole('link', { name: 'Archived' })
    .click()
  await expect(page).toHaveURL(`${boardPath}?view=archived`)
  await expect(backlog.getByRole('heading', { level: 3 })).toHaveText([
    'Write the brief',
    'Book the venue',
  ])
  await expect(backlog.getByText('Archived', { exact: true })).toHaveCount(2)
  await expect(done).toHaveCount(0)
  // Archived items are read-only: no forms to add or change them.
  await expect(page.getByLabel('Task title')).toHaveCount(0)

  // Restoring takes it out of the Archived view.
  await backlog
    .getByRole('button', { name: 'Actions for task Write the brief' })
    .click()
  await page.getByRole('menuitem', { name: 'Restore task' }).click()
  await expect(backlog.getByRole('heading', { level: 3 })).toHaveText([
    'Book the venue',
  ])
  await expect(
    backlog.getByRole('button', { name: 'Actions for task Book the venue' })
  ).toBeFocused()

  // Back in the Active view, it is in its old place.
  await page
    .getByRole('navigation', { name: 'Board view' })
    .getByRole('link', { name: 'Active' })
    .click()
  await expect(page).toHaveURL(boardPath)
  await expect(backlog.getByRole('heading', { level: 3 })).toHaveText([
    'Write the brief',
  ])
  await expect(done.getByRole('heading', { level: 3 })).toHaveText([
    'Pick the date',
  ])
})
