import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

import { groups } from './sections.mjs'

const repo = 'https://github.com/B-Jones-RFD/next-ddd-starter'

export default withMermaid(
  defineConfig({
    title: 'next-ddd-starter',
    description:
      'How the Next.js domain-driven design template is built, and why.',
    base: '/next-ddd-starter/',
    srcExclude: ['README.md'],
    // `site/standards.md` only includes the root file; serve it at the fixed `/standards/` slug.
    rewrites: { 'standards.md': 'standards/index.md' },
    // Dead internal links fail the build (VitePress's default; stated so nobody loosens it by accident).
    ignoreDeadLinks: false,
    themeConfig: {
      nav: [
        { text: 'Standards', link: '/standards/' },
        { text: 'Using this as a template', link: '/template/' },
      ],
      sidebar: [
        {
          items: [
            { text: 'Overview', link: '/' },
            { text: 'Standards', link: '/standards/' },
          ],
        },
        ...groups.map(({ text, items }) => ({
          text,
          items: items.map(({ text, link }) => ({ text, link })),
        })),
        { items: [{ text: 'Using this as a template', link: '/template/' }] },
      ],
      search: { provider: 'local' },
      socialLinks: [{ icon: 'github', link: repo }],
      editLink: {
        pattern: `${repo}/edit/main/site/:path`,
        text: 'Edit this page on GitHub',
      },
    },
  }),
)
