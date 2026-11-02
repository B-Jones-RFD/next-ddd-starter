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
