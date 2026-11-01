# Docs site

The VitePress site published at <https://b-jones-rfd.github.io/next-ddd-starter/>. It explains `standards.md` and never adds a rule. It is a self-contained project, so the app's `npm run check` ignores it.

```sh
cd site
npm ci
npm run dev    # local preview
npm run build  # ADR drift check, then a build that fails on dead links
```

- **Slugs are fixed.** `standards.md` links to them absolutely. The page map is `.vitepress/sections.mjs`.
- **`/standards/`** renders the root `standards.md` through `site/standards.md`'s include. Never copy rules into a page.
- **Cite ADRs** in frontmatter (`adrs: ['0007']`). The page then ends with a "Decisions behind this page" list.
- **`stub: true`** marks a page not yet written. Remove it when you write the page. While any section page is a stub, an ADR no page cites is a warning; after that it fails the build.
- **Code from this repo** is imported by region (`<<< @/../src/…/file.ts#name`, with `// #region name` markers in the file), never pasted.
- **Diagrams** are Mermaid code blocks.
