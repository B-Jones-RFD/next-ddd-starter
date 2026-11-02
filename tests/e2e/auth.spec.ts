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

test('a registered email gets an error under the email field, keeping the other entries', async ({
  page,
  browser,
}) => {
  const visitor = await signUp(page)
  const other = await browser.newPage()

  await other.goto('/sign-up')
  await other.getByLabel('Display name').fill('Someone Else')
  await other.getByLabel('Email').fill(` ${visitor.email.toUpperCase()} `)
  await other.getByLabel('Password').fill('another password')
  await other.getByRole('button', { name: 'Create account' }).click()

  const email = other.getByLabel('Email')
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toHaveAccessibleDescription(
    'That email is already registered. Sign in, or use another email.'
  )
  await expect(other.getByLabel('Display name')).toHaveValue('Someone Else')
  await expect(other).toHaveURL('/sign-up')
})

test('invalid fields get errors under their inputs', async ({ page }) => {
  await page.goto('/sign-up')
  await page.getByLabel('Display name').fill('Ada')
  await page.getByLabel('Email').fill('not-an-email')
  await page.getByLabel('Password').fill('short')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByLabel('Email')).toHaveAccessibleDescription(
    'Enter an email address like name@example.com.'
  )
  await expect(page.getByLabel('Password')).toHaveAccessibleDescription(
    'Use at least 8 characters.'
  )
  await expect(page.getByLabel('Display name')).toHaveValue('Ada')
  await expect(page.getByLabel('Display name')).not.toHaveAttribute(
    'aria-invalid'
  )
})
