import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'

// --- Module boundaries (ADR 0002) ---------------------------------------
// Flat config replaces a rule per file rather than merging it, so each scope
// below gets one complete `no-restricted-imports` block (and, where it has
// one, one complete `no-restricted-syntax` block), and the most specific
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
// Observability (§8, ADRs 0013, 0014).
const noPino = {
  group: ['pino', 'pino/*'],
  message:
    'Write diagnostic logs through @/shared/infrastructure/logging; pino is imported only there.',
}
const noMetricsSdk = {
  group: ['@opentelemetry/sdk-metrics', '@opentelemetry/exporter-metrics-*'],
  message:
    'Metrics go through getMeter() in @/shared/infrastructure/metrics (ADR 0014).',
}
const noMetricsApi = {
  name: '@opentelemetry/api',
  importNames: ['metrics'],
  message:
    'Metrics go through getMeter() in @/shared/infrastructure/metrics (ADR 0014).',
}

/** Bans that hold in every src/ scope, except where a later block lifts one. */
const SRC = { patterns: [noPino, noMetricsSdk], paths: [noMetricsApi] }

const restrict = (...patterns) => ({
  'no-restricted-imports': [
    'error',
    { patterns: [noParentRelative, ...patterns] },
  ],
})

/** `restrict` plus the src/-wide observability bans. */
const restrictSrc = (...patterns) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [noParentRelative, ...SRC.patterns, ...patterns],
      paths: SRC.paths,
    },
  ],
})

/** Allowlist: anything not matching `allowed` (a regex source) is an error. */
const onlyAllow = (allowed, message) => ({
  regex: `^(?!(?:${allowed})).+`,
  message,
})

// Span data is written only in src/shared/infrastructure/tracing/ (§8).
const noSpanWrites = {
  selector:
    'CallExpression[callee.property.name=/^(setAttribute|setAttributes|addEvent|recordException|setStatus)$/]',
  message:
    'Write span data only through the helpers in @/shared/infrastructure/tracing (ADR 0017).',
}

const syntax = (...selectors) => ({
  'no-restricted-syntax': ['error', noSpanWrites, ...selectors],
})

// api.ts exports only `traced(...)` use cases, error classes and types
// (ADR 0008), with span names `<module>.<exportName>` (ADR 0016).
const UC = '/\\/application\\/(commands|queries)\\//'
const apiShape = (ctx) => [
  {
    selector:
      "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:not([init.type='CallExpression'][init.callee.name='traced'])",
    message:
      "api.ts exports use cases only as `traced('<module>.<name>', useCase)`.",
  },
  {
    selector: `ExportNamedDeclaration[exportKind='value'][source.value=${UC}] > ExportSpecifier[exportKind='value']`,
    message: 'Wrap a command or query in traced() instead of re-exporting it.',
  },
  {
    selector: "ExportAllDeclaration[exportKind='value']",
    message: 'api.ts never uses `export *`; use `export type *` for types.',
  },
  {
    selector:
      "ExportNamedDeclaration[source=null] > ExportSpecifier[exportKind='value']",
    message: 'api.ts exports use cases only as `traced(...)` constants.',
  },
  {
    selector:
      'ExportNamedDeclaration > :matches(FunctionDeclaration, ClassDeclaration)',
    message: 'api.ts exports no functions or classes of its own.',
  },
  {
    selector: 'ExportDefaultDeclaration',
    message: 'api.ts has no default export.',
  },
  {
    selector: `CallExpression[callee.name='traced']:not([arguments.0.type='Literal'][arguments.0.value=/^${ctx}\\.[a-z][A-Za-z0-9]*$/])`,
    message: `Name the span '${ctx}.<exportName>', using exactly the exported name (ADR 0016).`,
  },
]

// contracts.ts is type-only.
const typeOnly = [
  {
    // `export {}` (an empty module) passes.
    selector:
      "ExportNamedDeclaration[exportKind='value']:not([declaration=null][specifiers.length=0])",
    message: 'contracts.ts re-exports types only.',
  },
  {
    selector: "ExportAllDeclaration[exportKind='value']",
    message: 'contracts.ts re-exports types only.',
  },
  {
    selector: "ImportDeclaration[importKind='value']",
    message: 'contracts.ts imports types only.',
  },
]

// #region context-boundaries
const contextBoundaries = CONTEXTS.flatMap((ctx) => {
  const others = `(?:${CONTEXTS.filter((c) => c !== ctx).join('|')})`
  const own = `@/modules/${ctx}`
  const dir = `src/modules/${ctx}`
  return [
    {
      files: [`${dir}/domain/${TS}`],
      rules: restrictSrc(
        onlyAllow(
          `${own}/domain/|@/shared/kernel/|\\./`,
          'domain/ imports only its own domain/ and @/shared/kernel. No IO, Zod, DI or other packages.'
        )
      ),
    },
    {
      files: [`${dir}/application/${TS}`],
      rules: restrictSrc(
        onlyAllow(
          `${own}/(?:domain|application)/|@/shared/kernel/|@/di/container$|@/modules/${others}/contracts$|zod$|\\./`,
          "application/ imports only its own domain/ and application/, @/shared/kernel, @/di/container, zod, and other contexts' contracts."
        )
      ),
    },
    {
      files: [`${dir}/infrastructure/${TS}`],
      rules: restrictSrc(
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
      files: [`${dir}/api.ts`],
      rules: {
        ...restrictSrc(
          onlyAllow(
            `${own}/(?:domain|application)/|@/shared/kernel/|@/shared/infrastructure/tracing$|server-only$`,
            "A module's api.ts re-exports only from its own domain/ and application/, wrapped with @/shared/infrastructure/tracing."
          )
        ),
        ...syntax(...apiShape(ctx)),
      },
    },
    {
      files: [`${dir}/contracts.ts`],
      rules: {
        ...restrictSrc(
          onlyAllow(
            `${own}/application/contracts/`,
            "A module's contracts.ts re-exports only its own application/contracts/."
          )
        ),
        ...syntax(...typeOnly),
      },
    },
  ]
})
// #endregion context-boundaries

const boundaries = [
  { files: [TS], rules: restrict() },
  {
    files: [`src/${TS}`],
    rules: {
      ...restrictSrc(noNextOrReact),
      ...syntax(),
      'no-console': 'error',
    },
  },
  // Thin Next shims at the src root.
  { files: ['src/proxy.ts', 'src/instrumentation.ts'], rules: restrictSrc() },
  // The Node half of `register()` builds the SDK, metric readers included.
  {
    files: ['src/instrumentation.node.ts'],
    rules: restrict(noPino, noNextOrReact),
  },
  // app/ can't reach OpenTelemetry at all, so its DOM `setAttribute` calls
  // are no span writes.
  {
    files: [`src/app/${TS}`],
    rules: {
      ...restrictSrc(
        {
          regex:
            '^@/(?!app/|modules/[^/]+/api$|shared/infrastructure/logging$)',
          message:
            'src/app/ imports only @/modules/*/api, @/app/** and @/shared/infrastructure/logging.',
        },
        {
          group: ['@opentelemetry/*'],
          message:
            'app/ records nothing on spans; `traced` and to-action-error do it (§8).',
        },
        noZod
      ),
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: [`src/di/${TS}`],
    rules: restrictSrc(
      { regex: '^@/app(?:/|$)', message: 'src/di/ never imports @/app.' },
      noNextOrReact,
      noZod
    ),
  },
  {
    files: [`src/shared/kernel/${TS}`],
    rules: restrictSrc(
      onlyAllow(
        '@/shared/kernel/|\\./',
        'The shared kernel imports only itself. No IO or packages.'
      )
    ),
  },
  {
    files: [`src/shared/infrastructure/${TS}`],
    rules: restrictSrc(
      {
        regex: '^@/(?:modules|di|app)(?:/|$)',
        message:
          'src/shared/infrastructure/ imports only @/shared/** and packages.',
      },
      noNextOrReact,
      noZod
    ),
  },
  // The logging facade is the one place pino is imported.
  {
    files: [`src/shared/infrastructure/logging/${TS}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noParentRelative,
            noMetricsSdk,
            {
              regex: '^@/(?:modules|di|app)(?:/|$)',
              message:
                'The logging facade imports only @/shared/** and packages.',
            },
            noNextOrReact,
            noZod,
          ],
          paths: [noMetricsApi],
        },
      ],
    },
  },
  // The metrics facade is the one place the metrics API is imported.
  {
    files: [`src/shared/infrastructure/metrics/${TS}`],
    rules: restrict(
      noPino,
      {
        regex: '^@/(?:modules|di|app)(?:/|$)',
        message: 'The metrics facade imports only @/shared/** and packages.',
      },
      noNextOrReact,
      noZod
    ),
  },
  // Span data is written here and nowhere else.
  {
    files: [`src/shared/infrastructure/tracing/${TS}`],
    rules: { 'no-restricted-syntax': 'off' },
  },
  ...contextBoundaries,
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Accessibility (§10): the full recommended set. eslint-config-next registers
  // the plugin and turns on a few rules as warnings, so only the rules go here.
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
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
          pathGroups: [
            { pattern: '@/**', group: 'internal' },
            { pattern: '@tests/**', group: 'internal', position: 'after' },
          ],
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
    // The docs site is a self-contained project outside `npm run check`.
    'site/**',
  ]),
])

export default eslintConfig
