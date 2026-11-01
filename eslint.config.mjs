import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'
import tseslint from 'typescript-eslint'

// --- Module boundaries (ADR 0002) ---------------------------------------
// Flat config replaces a rule per file rather than merging it, so each scope
// below gets one complete `no-restricted-imports` block, and the most specific
// block for a file comes last.

const CONTEXTS = ['identity', 'boards', 'audit']
const TS = '**/*.{ts,tsx,mts,cts}'

const noParentRelative = {
  regex: '^\\.\\.(?:/|$)',
  message: "Use the '@/' alias instead of '../'.",
}
const noNextOrReact = {
  group: ['next', 'next/*', 'react', 'react/*', 'react-dom', 'react-dom/*'],
  message:
    'Next and React are imported only in src/app/ and the root proxy.ts/instrumentation.ts shims.',
}
const noZod = {
  group: ['zod', 'zod/*'],
  message: 'Zod is imported only in a module’s application/ input schemas.',
}

const restrict = (...patterns) => ({
  'no-restricted-imports': [
    'error',
    { patterns: [noParentRelative, ...patterns] },
  ],
})

/** Allowlist: anything not matching `allowed` (a regex source) is an error. */
const onlyAllow = (allowed, message) => ({
  regex: `^(?!(?:${allowed})).+`,
  message,
})

const contextBoundaries = CONTEXTS.flatMap((ctx) => {
  const others = `(?:${CONTEXTS.filter((c) => c !== ctx).join('|')})`
  const own = `@/modules/${ctx}`
  const dir = `src/modules/${ctx}`
  return [
    {
      files: [`${dir}/domain/${TS}`],
      rules: restrict(
        onlyAllow(
          `${own}/domain/|@/shared/kernel/|\\./`,
          'domain/ imports only its own domain/ and @/shared/kernel. No IO, Zod, DI or other packages.'
        )
      ),
    },
    {
      files: [`${dir}/application/${TS}`],
      rules: restrict(
        onlyAllow(
          `${own}/(?:domain|application)/|@/shared/kernel/|@/di/container$|@/modules/${others}/contracts$|zod$|\\./`,
          "application/ imports only its own domain/ and application/, @/shared/kernel, @/di/container, zod, and other contexts' contracts."
        )
      ),
    },
    {
      files: [`${dir}/infrastructure/${TS}`],
      rules: restrict(
        {
          regex: `^@/modules/(?!${ctx}/(?:domain|application|infrastructure)/|${others}/(?:api|contracts)$)`,
          message:
            "infrastructure/ imports only its own layers and other contexts' api and contracts. Never its own api.ts or contracts.ts.",
        },
        {
          regex: '^@/(?:di|app)(?:/|$)',
          message: 'infrastructure/ never imports @/di or @/app.',
        },
        noNextOrReact,
        noZod
      ),
    },
    {
      files: [`${dir}/api.ts`, `${dir}/contracts.ts`],
      rules: restrict(
        onlyAllow(
          `${own}/(?:domain|application)/|@/shared/kernel/|server-only$`,
          "A module's api.ts and contracts.ts re-export only from its own domain/ and application/."
        )
      ),
    },
  ]
})

const boundaries = [
  { files: [TS], rules: restrict() },
  { files: [`src/${TS}`], rules: restrict(noNextOrReact) },
  // Thin Next shims at the src root.
  { files: ['src/proxy.ts', 'src/instrumentation.ts'], rules: restrict() },
  {
    files: [`src/app/${TS}`],
    rules: restrict(
      {
        regex: '^@/(?!app/|modules/[^/]+/api$)',
        message: 'src/app/ imports only @/modules/*/api and @/app/**.',
      },
      noZod
    ),
  },
  {
    files: [`src/di/${TS}`],
    rules: restrict(
      { regex: '^@/app(?:/|$)', message: 'src/di/ never imports @/app.' },
      noNextOrReact,
      noZod
    ),
  },
  {
    files: [`src/shared/kernel/${TS}`],
    rules: restrict(
      onlyAllow(
        '@/shared/kernel/|\\./',
        'The shared kernel imports only itself. No IO or packages.'
      )
    ),
  },
  {
    files: [`src/shared/infrastructure/${TS}`],
    rules: restrict(
      {
        regex: '^@/(?:modules|di|app)(?:/|$)',
        message:
          'src/shared/infrastructure/ imports only @/shared/** and packages.',
      },
      noNextOrReact,
      noZod
    ),
  },
  ...contextBoundaries,
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    rules: {
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
        },
      ],
    },
  },
  ...boundaries,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Agent worktrees are separate checkouts.
    '.claude/**',
  ]),
])

export default eslintConfig
