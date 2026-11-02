import { expect, test } from '@playwright/test'

import { aNewVisitor, signUp } from '@tests/fixtures/visitors'

// The auth critical flow (#60). This slice covers sign-up; sign-out and
// sign-in join it in slice 3.

test('a visitor signs up and lands on their boards, signed in', async ({
  page,
}) => {
  const visitor = await signUp(page, aNewVisitor('Ada Lovelace'))

  await expect(
    page.getByRole('heading', { level: 1, name: 'Your boards' })
  ).toBeVisible()
  await expect(page.getByText('Welcome, Ada Lovelace.')).toBeVisible()
  await expect(page.getByText('No boards yet')).toBeVisible()

  // The session cookie keeps them signed in on a fresh load.
  await page.reload()
  await expect(page.getByText(`Welcome, ${visitor.displayName}.`)).toBeVisible()
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

test('a signed-out visitor opening /boards is sent to sign up', async ({
  page,
}) => {
  await page.goto('/boards')

  await expect(page).toHaveURL('/sign-up')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Create your account' })
  ).toBeVisible()
})
