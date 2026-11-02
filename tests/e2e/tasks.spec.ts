import { expect, test } from '@playwright/test'

import {
  addListNamed,
  addTaskNamed,
  createBoardNamed,
  signUp,
} from '@tests/fixtures/visitors'

test('a Board member creates a board, a list and a task, then works with the task in its dialog and page', async ({
  page,
}) => {
  await signUp(page)
  const boardPath = await createBoardNamed(page, 'Launch plan')
  await addListNamed(page, 'Backlog')
  await addListNamed(page, 'Done')
  await addTaskNamed(page, 'Backlog', 'Write the brief')
  await addTaskNamed(page, 'Backlog', 'Book the venue')

  // The task opens as a dialog over the board, focused on its title.
  const backlog = page.getByRole('region', { name: 'Backlog', exact: true })
  await backlog.getByRole('link', { name: 'Write the brief' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Write the brief' })
  ).toBeVisible()
  // The dialog is named by the title, which changes below.
  const dialog = page.getByRole('dialog')
  await expect(page).toHaveURL(new RegExp(`${boardPath}/tasks/[^/]+$`))
  await expect(
    dialog.getByRole('heading', { name: 'Write the brief' })
  ).toBeFocused()
  // The board stays under it (inert while the dialog is open).
  await expect(page.locator('h1', { hasText: 'Launch plan' })).toBeVisible()

  // An empty title is rejected under its field.
  await dialog.getByLabel('Title').fill('')
  await dialog.getByRole('button', { name: 'Save title' }).click()
  await expect(dialog.getByText('Enter a title.')).toBeVisible()

  await dialog.getByLabel('Title').fill('Write the launch brief')
  await dialog.getByRole('button', { name: 'Save title' }).click()
  await expect(
    dialog.getByRole('heading', { name: 'Write the launch brief' })
  ).toBeVisible()
  await dialog.getByLabel('Description').fill('One page, for the press.')
  await dialog.getByRole('button', { name: 'Save description' }).click()
  await expect(dialog.getByLabel('Description')).toHaveValue(
    'One page, for the press.'
  )

  // Closing returns to the board, with focus on the task.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(boardPath)
  await expect(
    backlog.getByRole('link', { name: 'Write the launch brief' })
  ).toBeFocused()

  // Reorder from the ⋯ menu: focus follows the task's ⋯ to its new place.
  await backlog
    .getByRole('button', { name: 'Actions for task Write the launch brief' })
    .click()
  await page.getByRole('menuitem', { name: 'Move down' }).click()
  await expect(backlog.getByRole('heading', { level: 3 })).toHaveText([
    'Book the venue',
    'Write the launch brief',
  ])
  await expect(
    backlog.getByRole('button', {
      name: 'Actions for task Write the launch brief',
    })
  ).toBeFocused()

  // "Move to list…" changes its status.
  await backlog
    .getByRole('button', { name: 'Actions for task Write the launch brief' })
    .click()
  await page.getByRole('menuitem', { name: 'Move to list…' }).click()
  const move = page.getByRole('dialog', {
    name: 'Move “Write the launch brief”',
  })
  await move.getByLabel('List').selectOption({ label: 'Done' })
  await move.getByRole('button', { name: 'Move task' }).click()
  await expect(move).toBeHidden()
  const done = page.getByRole('region', { name: 'Done', exact: true })
  await expect(
    done.getByRole('heading', { level: 3, name: 'Write the launch brief' })
  ).toBeVisible()
  await expect(
    done.getByRole('button', {
      name: 'Actions for task Write the launch brief',
    })
  ).toBeFocused()

  // Loaded directly, the task is a full page.
  await done.getByRole('link', { name: 'Write the launch brief' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Write the launch brief' })
  ).toBeVisible()
  await expect(page.getByText('Launch plan · in Done')).toBeVisible()
  await expect(page.getByLabel('Description')).toHaveValue(
    'One page, for the press.'
  )
})
