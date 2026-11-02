import { expect, test } from '@playwright/test'

import {
  aNewVisitor,
  signInWith,
  signOut,
  signUp,
} from '@tests/fixtures/visitors'

// The auth critical flow (#60): sign up, sign out, sign in.

test('a visitor signs up, signs out and signs back in', async ({ page }) => {
  const visitor = await signUp(page, aNewVisitor('Ada Lovelace'))

  await expect(
    page.getByRole('heading', { level: 1, name: 'Your boards' })
  ).toBeVisible()
  await expect(page.getByText('Welcome, Ada Lovelace.')).toBeVisible()
  await expect(page.getByText('No boards yet')).toBeVisible()

  // The session cookie keeps them signed in on a fresh load.
  await page.reload()
  await expect(page.getByText(`Welcome, ${visitor.displayName}.`)).toBeVisible()

  await signOut(page, visitor.displayName)
  await page.goto('/boards')
  await expect(page).toHaveURL('/sign-in?next=%2Fboards')

  await signInWith(page, visitor)
  await expect(page).toHaveURL('/boards')
  await expect(page.getByText(`Welcome, ${visitor.displayName}.`)).toBeVisible()
})

test('a wrong password gets one alert that doesn’t say which part was wrong', async ({
  page,
}) => {
  const visitor = await signUp(page)
  await signOut(page, visitor.displayName)

  await signInWith(page, { ...visitor, password: 'not the password' })

  await expect(
    page.getByRole('alert').filter({
      hasText: 'That email and password don’t match. Check them and try again.',
    })
  ).toBeVisible()
  await expect(page.getByLabel('Email')).toHaveValue(visitor.email)
  await expect(page).toHaveURL('/sign-in')
})

test('a signed-out visitor opening a protected page signs in and returns to it', async ({
  page,
}) => {
  const visitor = await signUp(page)
  await signOut(page, visitor.displayName)

  await page.goto('/account')
  await expect(page).toHaveURL('/sign-in?next=%2Faccount')
  await signInWith(page, visitor)

  await expect(page).toHaveURL('/account')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Your account' })
  ).toBeVisible()
})

test('a stale session cookie still lets the visitor sign in', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'session', value: 'stale', url: 'http://localhost:3100' },
  ])

  await page.goto('/boards')
  await expect(page).toHaveURL('/sign-in?next=%2Fboards')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sign in' })
  ).toBeVisible()
})
