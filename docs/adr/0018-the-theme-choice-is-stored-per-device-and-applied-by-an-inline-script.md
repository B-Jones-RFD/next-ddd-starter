# The theme choice is stored per device and applied by an inline script

The app follows the system theme, and users can pick System, Light or Dark from the account menu. The choice is kept in `localStorage`, not in a cookie or on the User. A small hand-written inline script in the root layout's `<head>` reads it and sets `data-theme` on `<html>` before first paint, so the wrong theme never flashes. The server never reads the theme. If the root layout read a cookie, `<html>` would depend on the request. Under Cache Components that makes the whole static shell dynamic, and `<html>` can't go inside `<Suspense>`. A viewer-dependent `<html>` also goes against [ADR 0011](./0011-server-components-read-server-actions-write-nothing-cached-per-viewer.md)'s rule that nothing cached depends on the viewer.

## Decisions

- **The CSS `dark` variant means `[data-theme=dark]`, or `prefers-color-scheme: dark` when no `data-theme` is set.** The system theme works before hydration and without JS. The script sets `data-theme` only for an explicit Light or Dark.
- **When the choice is System, a `matchMedia` listener keeps the theme live** as the OS switches.
- **`<html>` has `suppressHydrationWarning`**, because the script changes its attributes before React hydrates.
- **There's no `next-themes`.** The script is about 15 lines, in keeping with the low-dependency rule.

## Considered Options

- **A cookie read in the root layout.** Rejected for the reasons above.
- **A preference on the User in identity.** Rejected. It needs a server read before paint, which runs into the same problem, and it adds a column and a command for a per-device display choice.
- **System only, with no toggle.** Rejected. Users can't override the theme for this app.

## Consequences

- The choice doesn't follow a user to another device or browser.
- With JS off, an explicit Light or Dark choice isn't applied. The system theme still is.
- This is _decided per project_. An app that needs the choice to roam can store it on the User, and then has to accept a dynamic shell.
