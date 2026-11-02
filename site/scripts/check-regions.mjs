// Code-import check, run before every site build next to the ADR check.
// VitePress quietly imports a whole file when a `<<< …#name` region is
// missing, so a page would show the wrong code without anyone noticing.
// - Fails if a `<<< @/…` import names a file that doesn't exist.
// - Fails if it names a region the file doesn't mark with both
//   `#region name` and `#endregion name`.
// - Fails if any imported file's region markers don't pair up.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const siteDir = join(import.meta.dirname, '..')

function pages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return []
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return pages(path)
    return entry.name.endsWith('.md') ? [path] : []
  })
}

// `<<< @/path#region{lang}`, where `@` is the site's source folder. The
// optional `{…}` holds the language and line highlights.
const IMPORT = /^\s*<<<\s+@\/(\S+?)(?:#([\w-]+))?(?:\{[^}]*\})?\s*$/gm
const MARKER = /#(region|endregion)\s+([\w-]+)/g

/** Problems with the region markers in one file's source. */
function markerProblems(source) {
  const open = []
  const problems = []
  for (const [, kind, name] of source.matchAll(MARKER)) {
    if (kind === 'region') {
      open.push(name)
    } else if (open.at(-1) === name) {
      open.pop()
    } else {
      problems.push(`#endregion ${name} closes ${open.at(-1) ?? 'nothing'}`)
    }
  }
  for (const name of open) problems.push(`#region ${name} is never closed`)
  return problems
}

const errors = []
const checked = new Map()
let imports = 0

for (const file of pages(siteDir)) {
  const page = relative(siteDir, file)
  for (const [, path, region] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
    imports += 1
    const target = join(siteDir, path)
    const shown = relative(join(siteDir, '..'), target)
    if (!existsSync(target)) {
      errors.push(`${page} imports ${shown}, which doesn't exist.`)
      continue
    }
    const source = readFileSync(target, 'utf8')
    if (!checked.has(shown)) {
      checked.set(shown, true)
      for (const problem of markerProblems(source)) {
        errors.push(`${shown}: ${problem}.`)
      }
    }
    if (!region) continue
    const names = (kind) =>
      [...source.matchAll(MARKER)]
        .filter((match) => match[1] === kind)
        .map((match) => match[2])
    if (!names('region').includes(region) || !names('endregion').includes(region)) {
      errors.push(`${page} imports ${shown}#${region}, but the file has no such region.`)
    }
  }
}

if (errors.length > 0) {
  console.error(`Code-import check failed:\n${errors.map((e) => `- ${e}`).join('\n')}`)
  process.exit(1)
}
console.log(`Code-import check passed: ${imports} imports from ${checked.size} files.`)
