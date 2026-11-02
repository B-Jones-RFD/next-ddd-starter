import { randomUUID } from 'node:crypto'

import { expect, type Page } from '@playwright/test'

/** A visitor nobody has signed up as yet, so no spec depends on another. */
export function aNewVisitor(displayName = 'Ada Lovelace') {
  return {
    displayName,
    email: `e2e-${randomUUID()}@example.com`,
    password: 'correct horse battery',
  }
}

/** Signs a new visitor up through the form and waits for `/boards`. */
export async function signUp(
  page: Page,
  visitor: ReturnType<typeof aNewVisitor> = aNewVisitor()
) {
  await page.goto('/sign-up')
  await page.getByLabel('Display name').fill(visitor.displayName)
  await page.getByLabel('Email').fill(visitor.email)
  await page.getByLabel('Password').fill(visitor.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/boards')
  return visitor
}

/** Fills and submits the sign-in form on the current page. */
export async function signInWith(
  page: Page,
  credentials: { email: string; password: string }
) {
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** Signs out through the account menu and waits for `/sign-in`. */
export async function signOut(page: Page, displayName: string) {
  await page
    .getByRole('button', { name: `Account menu for ${displayName}` })
    .click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/sign-in')
}

/**
 * Creates a board through the "Create board" dialog on `/boards`, opens it,
 * and returns its path.
 */
export async function createBoardNamed(page: Page, name: string) {
  await page.goto('/boards')
  await page.getByRole('button', { name: 'Create board' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create board' })
  await dialog.getByLabel('Board name').fill(name)
  await dialog.getByRole('button', { name: 'Create board' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return new URL(page.url()).pathname
}

/** Adds a list through the form after the board's last column. */
export async function addListNamed(page: Page, name: string) {
  await page.getByLabel('List name').fill(name)
  await page.getByRole('button', { name: 'Add list' }).click()
  await expect(
    page.getByRole('heading', { level: 2, name, exact: true })
  ).toBeVisible()
}

/**
 * As the board's Owner, searches the Members tab for `email`, adds the user
 * it finds, and waits until they are listed. Leaves the page on the tab.
 */
export async function addMemberByEmail(
  page: Page,
  boardPath: string,
  email: string
) {
  await page.goto(`${boardPath}/settings/members`)
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('button', { name: /^Add / }).click()
  await expect(page.getByRole('button', { name: /^Remove / })).toBeVisible()
}

/** Adds a task through the form at the foot of the named list's column. */
export async function addTaskNamed(
  page: Page,
  listName: string,
  title: string
) {
  const list = page.getByRole('region', { name: listName, exact: true })
  await list.getByLabel('Task title').fill(title)
  await list.getByRole('button', { name: 'Add task' }).click()
  await expect(
    list.getByRole('heading', { level: 3, name: title, exact: true })
  ).toBeVisible()
}

/**
 * Defines a tag on the board's Tags tab, choosing its Tag color by name.
 * Leaves the page on the tab.
 */
export async function addTagNamed(
  page: Page,
  boardPath: string,
  name: string,
  color: string
) {
  if (!page.url().endsWith(`${boardPath}/settings/tags`)) {
    await page.goto(`${boardPath}/settings/tags`)
  }
  await page.getByLabel('Tag name').fill(name)
  await page.getByRole('radio', { name: color, exact: true }).check()
  await page.getByRole('button', { name: 'Add tag' }).click()
  await expect(
    page.getByRole('button', { name: `Delete tag ${name}` })
  ).toBeVisible()
}
