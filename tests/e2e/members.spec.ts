import { expect, test } from '@playwright/test'

import {
  aNewVisitor,
  addMemberByEmail,
  createBoardNamed,
  signUp,
} from '@tests/fixtures/visitors'

test('an Owner adds a registered user as a Member, who then sees the board', async ({
  browser,
}) => {
  const benContext = await browser.newContext()
  const benPage = await benContext.newPage()
  const ben = await signUp(benPage, aNewVisitor('Ben'))

  const adaContext = await browser.newContext()
  const adaPage = await adaContext.newPage()
  await signUp(adaPage, aNewVisitor('Ada'))
  const boardPath = await createBoardNamed(adaPage, 'Launch plan')

  await addMemberByEmail(adaPage, boardPath, ben.email)

  await expect(
    adaPage.getByRole('img', { name: 'Members: Ada (Owner), Ben' })
  ).toBeVisible()

  await benPage.goto('/boards')
  await benPage.getByRole('link', { name: 'Launch plan' }).click()
  await expect(
    benPage.getByRole('heading', { level: 1, name: 'Launch plan' })
  ).toBeVisible()
  await expect(
    benPage.getByRole('img', { name: 'Members: Ada (Owner), Ben' })
  ).toBeVisible()

  await adaContext.close()
  await benContext.close()
})
