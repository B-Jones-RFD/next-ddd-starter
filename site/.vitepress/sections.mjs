// The site's page map: one entry per page that has a slug fixed by
// "Docs site generator and setup" (#27). The sidebar and the ADR drift check
// both read it, so a page can't be added to one and forgotten by the other.

/** `section` is the `standards.md` section number; pages without one aren't section pages. */
export const groups = [
  {
    text: 'Foundations',
    items: [
      { section: 1, text: 'Scale', link: '/scale/' },
      { section: 2, text: 'Layout', link: '/layout/' },
      { section: 12, text: 'Tooling', link: '/tooling/' },
    ],
  },
  {
    text: 'The model',
    items: [
      { section: 3, text: 'Domain', link: '/domain/' },
      { section: 4, text: 'Application', link: '/application/' },
      { section: 6, text: 'Contexts', link: '/contexts/' },
      { text: 'Domain language', link: '/language/' },
    ],
  },
  {
    text: 'The edges',
    items: [
      { section: 5, text: 'Infrastructure', link: '/infrastructure/' },
      { section: 7, text: 'Errors', link: '/errors/' },
      { section: 8, text: 'Observability', link: '/observability/' },
      { section: 9, text: 'Auth', link: '/auth/' },
      { section: 10, text: 'Presentation', link: '/presentation/' },
    ],
  },
  {
    text: 'Quality',
    items: [
      { section: 11, text: 'Testing', link: '/testing/' },
      { section: 13, text: 'Exceptions', link: '/exceptions/' },
    ],
  },
]

/** Section pages 1–13: the drift check is strict once none of them is a stub. */
export const sectionPages = groups
  .flatMap((group) => group.items)
  .filter((item) => item.section !== undefined)
