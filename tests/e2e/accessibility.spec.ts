import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { THEME_STORAGE_KEY } from '@/app/_lib/theme/theme'

// The one axe sweep (§10). A slice that adds a screen registers it here, and
// the sweep checks it in both themes. `path` is visited as-is.
type Screen = { name: string; path: string; status?: number }

const SCREENS: Screen[] = [
  { name: 'home', path: '/' },
  { name: 'not found', path: '/this-page-does-not-exist', status: 404 },
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

    for (const screen of SCREENS) {
      test(`${screen.name} has no WCAG 2.2 AA violations`, async ({ page }) => {
        const response = await page.goto(screen.path)
        expect(response?.status()).toBe(screen.status ?? 200)
        const html = page.locator('html')
        await expect(html).toHaveAttribute('data-theme', theme)
        await expect(html).toHaveCSS('color-scheme', theme)

        const results = await new AxeBuilder({ page })
          .withTags(WCAG_22_AA)
          .analyze()

        expect(results.violations).toEqual([])
      })
    }
  })
}
