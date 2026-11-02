import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { THEME_STORAGE_KEY } from '@/app/_lib/theme/theme'

import {
  addListNamed,
  addTaskNamed,
  aNewVisitor,
  addMemberByEmail,
  createBoardNamed,
  signOut,
  signUp,
} from '@tests/fixtures/visitors'

// #region screen
// The one axe sweep (§10). A slice that adds a screen registers it here, and
// the sweep checks it in both themes. `path` is visited after `arrange` (which
// signs a visitor up, for screens behind a session); a function path is
// worked out from where `arrange` left the page. `act` runs after the visit,
// for screens a click opens, such as a dialog.
type Screen = {
  name: string
  path: string | ((page: Page) => string)
  status?: number
  arrange?: (page: Page) => Promise<unknown>
  act?: (page: Page) => Promise<unknown>
  /** Visited at this size; the desktop default otherwise. */
  viewport?: { width: number; height: number }
}
// #endregion screen

/** Signs up and creates a board, leaving the page on it. */
async function withBoard(page: Page) {
  await signUp(page)
  await createBoardNamed(page, 'Launch plan')
}

/** A board with three lists, leaving the page on it. */
async function withLists(page: Page) {
  await withBoard(page)
  for (const name of ['Backlog', 'In progress', 'Done']) {
    await addListNamed(page, name)
  }
}

/** Lists with tasks, leaving the page on the board. */
async function withTasks(page: Page) {
  await withLists(page)
  await addTaskNamed(page, 'Backlog', 'Write the brief')
  await addTaskNamed(page, 'Backlog', 'Book the venue')
  await addTaskNamed(page, 'Done', 'Pick the date')
}

/** Opens the task dialog from its link on the board. */
async function openTask(page: Page) {
  await page.getByRole('link', { name: 'Write the brief' }).click()
  await expect(
    page.getByRole('heading', { name: 'Write the brief' })
  ).toBeFocused()
  await settled(page)
}

/** Waits for the open dialog's fade-in, which axe would see half-done. */
async function settled(page: Page) {
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1')
  await expect(page.getByRole('menu')).toHaveCount(0)
}

/** Leaves the page on a task's own path. */
async function withTaskOpen(page: Page) {
  await withTasks(page)
  await openTask(page)
}

/** Opens a task's "Move to list…" picker from its ⋯ menu. */
async function openMovePicker(page: Page) {
  await page
    .getByRole('button', { name: 'Actions for task Write the brief' })
    .click()
  await page.getByRole('menuitem', { name: 'Move to list…' }).click()
  await settled(page)
}

/** In the open task dialog, assigns the visitor themself with the picker. */
async function assignSelf(page: Page) {
  await openTask(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Assign', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /^Unassign / })).toBeVisible()
}

/** A task with an assignee, leaving the page on the board. */
async function withAssignee(page: Page) {
  await withTasks(page)
  await assignSelf(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('img', { name: /^Assignees: / })).toBeVisible()
}

const PHONE = { width: 390, height: 844 }

/**
 * Signs Ben up, then Ada, who creates a board and adds Ben. Leaves the page
 * on the board's Members tab, as its Owner.
 */
async function withMember(page: Page) {
  const ben = await signUp(page, aNewVisitor('Ben'))
  await signOut(page, ben.displayName)
  await signUp(page, aNewVisitor('Ada'))
  const boardPath = await createBoardNamed(page, 'Launch plan')
  await addMemberByEmail(page, boardPath, ben.email)
}

const here = (page: Page) => new URL(page.url()).pathname

const SCREENS: Screen[] = [
  { name: 'home', path: '/' },
  { name: 'not found', path: '/this-page-does-not-exist', status: 404 },
  { name: 'sign up', path: '/sign-up' },
  { name: 'sign in', path: '/sign-in' },
  { name: 'boards (empty)', path: '/boards', arrange: signUp },
  // With the User log of the sign-up.
  { name: 'account', path: '/account', arrange: signUp },
  { name: 'boards (grid)', path: '/boards', arrange: withBoard },
  { name: 'board', path: here, arrange: withBoard },
  { name: 'board with lists', path: here, arrange: withLists },
  {
    name: 'board with lists (mobile)',
    path: here,
    arrange: withLists,
    viewport: PHONE,
  },
  { name: 'board with tasks', path: here, arrange: withTasks },
  {
    name: 'move to list picker',
    path: here,
    arrange: withTasks,
    act: openMovePicker,
  },
  { name: 'task dialog', path: here, arrange: withTasks, act: openTask },
  {
    name: 'task dialog (mobile)',
    path: here,
    arrange: withTasks,
    act: openTask,
    viewport: PHONE,
  },
  {
    name: 'assignee picker with an assignee',
    path: here,
    arrange: withTasks,
    act: assignSelf,
  },
  { name: 'board with an assigned task', path: here, arrange: withAssignee },
  // A direct load of the task's path is its full page.
  { name: 'task page', path: here, arrange: withTaskOpen },
  {
    name: 'board settings',
    path: (page) => `${here(page)}/settings`,
    arrange: withBoard,
  },
  {
    name: 'board log (with reorders shown)',
    path: (page) => `${here(page)}/settings/log?reorders=1`,
    arrange: withTasks,
  },
  {
    name: 'board members (Owner, with a Member and a search)',
    // `withMember` leaves the page on the Members tab, after a search.
    path: (page) => `${here(page)}${new URL(page.url()).search}`,
    arrange: withMember,
  },
]

const THEMES = ['light', 'dark'] as const

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    // The OS prefers the other theme, so the stored choice must win.
    test.use({ colorScheme: theme === 'light' ? 'dark' : 'light' })

    test.beforeEach(async ({ page }) => {
      // The same key the inline <head> script reads before first paint.
      await page.addInitScript(
        ([key, value]) => localStorage.setItem(key, value),
        [THEME_STORAGE_KEY, theme] as const
      )
    })

    // #region sweep
    for (const screen of SCREENS) {
      test(`${screen.name} has no WCAG 2.2 AA violations`, async ({ page }) => {
        await screen.arrange?.(page)
        if (screen.viewport) await page.setViewportSize(screen.viewport)
        const path =
          typeof screen.path === 'string' ? screen.path : screen.path(page)
        const response = await page.goto(path)
        expect(response?.status()).toBe(screen.status ?? 200)
        const html = page.locator('html')
        await expect(html).toHaveAttribute('data-theme', theme)
        await expect(html).toHaveCSS('color-scheme', theme)
        await screen.act?.(page)

        const results = await new AxeBuilder({ page })
          .withTags(WCAG_22_AA)
          .analyze()

        expect(results.violations).toEqual([])
      })
    }
    // #endregion sweep
  })
}
