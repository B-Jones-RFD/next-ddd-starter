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
