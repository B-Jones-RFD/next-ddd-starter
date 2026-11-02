import { expect, test } from '@playwright/test'

import {
  aNewVisitor,
  addListNamed,
  addTaskNamed,
  createBoardNamed,
  signUp,
} from '@tests/fixtures/visitors'

test('a Board member comments on a task and sees the comment in its Activity', async ({
  page,
}) => {
  await signUp(page, aNewVisitor('Ben'))
  await createBoardNamed(page, 'Launch plan')
  await addListNamed(page, 'Backlog')
  await addTaskNamed(page, 'Backlog', 'Write the brief')
  await page.getByRole('link', { name: 'Write the brief' }).click()
  const dialog = page.getByRole('dialog', { name: 'Write the brief' })
  const activity = dialog.getByRole('region', { name: 'Activity' })
  await expect(activity.getByRole('listitem')).toHaveText([/created the task/])

  // An empty comment is rejected under its field.
  await dialog.getByRole('button', { name: 'Post comment' }).click()
  await expect(dialog.getByText('Write a comment.')).toBeVisible()

  // A comment shows at the top of Activity at once, and the post is
  // announced, not Activity itself.
  await dialog.getByLabel('Comment').fill('Can we keep it to one page?')
  await dialog.getByRole('button', { name: 'Post comment' }).click()
  await expect(activity.getByRole('listitem').first()).toContainText(
    'Ben commented'
  )
  await expect(activity.getByRole('listitem').first()).toContainText(
    'Can we keep it to one page?'
  )
  await expect(dialog.getByLabel('Comment')).toHaveValue('')
  await expect(dialog.getByRole('status')).toHaveText('Comment posted')

  // It stays: Activity has its entry, with its author and time.
  await expect(async () => {
    await page.reload()
    const entries = page
      .getByRole('region', { name: 'Activity' })
      .getByRole('listitem')
    await expect(entries).toHaveText([
      /Ben commented\s*Can we keep it to one page\?.*\d{2}:\d{2}/,
      /created the task/,
    ])
  }).toPass()
})
