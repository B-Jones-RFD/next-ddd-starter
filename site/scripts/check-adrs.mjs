// ADR drift check, run before every site build ("Docs site generator and setup", #27).
// - Fails if a page cites an ADR that doesn't exist.
// - Lists ADRs no page cites: a warning while any section page is a stub
//   (`stub: true` in its frontmatter), a failure once all are written.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { sectionPages } from '../.vitepress/sections.mjs'

const siteDir = join(import.meta.dirname, '..')
const adrDir = join(siteDir, '..', 'docs', 'adr')

const adrs = new Set(
  readdirSync(adrDir)
    .filter((name) => /^\d{4}-.+\.md$/.test(name))
    .map((name) => name.slice(0, 4)),
)

function pages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return []
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return pages(path)
    return entry.name.endsWith('.md') ? [path] : []
  })
}

/** Reads the two frontmatter keys the check needs: `adrs` (inline or block list) and `stub`. */
function frontmatter(source) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? ''
  const inline = /^adrs:\s*\[(.*)\]\s*$/m.exec(block)?.[1]
  const list = /^adrs:\s*\r?\n((?:\s+-\s*.+\r?\n?)+)/m.exec(block)?.[1]
  const raw = inline !== undefined ? inline.split(',') : (list?.split('\n') ?? [])
  const cited = raw
    .map((item) => item.replace(/^\s*-\s*/, '').trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
  return { adrs: cited, stub: /^stub:\s*true\s*$/m.test(block) }
}

const errors = []
const cited = new Set()
const stubs = new Set()

for (const file of pages(siteDir)) {
  const page = relative(siteDir, file)
  const { adrs: pageAdrs, stub } = frontmatter(readFileSync(file, 'utf8'))
  if (stub) stubs.add(page)
  for (const number of pageAdrs) {
    if (adrs.has(number)) cited.add(number)
    else errors.push(`${page} cites ADR ${number}, which doesn't exist in docs/adr/.`)
  }
}

const sectionFiles = sectionPages.map(({ link }) => join(link.slice(1), 'index.md'))
const stubbedSections = sectionFiles.filter((file) => stubs.has(file))
const uncited = [...adrs].filter((number) => !cited.has(number)).sort()

if (uncited.length > 0) {
  const message = `No page cites ADR ${uncited.join(', ')}.`
  if (stubbedSections.length > 0) {
    console.warn(
      `warning: ${message} (A warning until all ${sectionFiles.length} section pages are written; ${stubbedSections.length} are still stubs.)`,
    )
  } else {
    errors.push(message)
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`error: ${error}`)
  process.exit(1)
}
console.log(
  `ADR drift check passed: ${cited.size} of ${adrs.size} ADRs cited, ${stubbedSections.length} of ${sectionFiles.length} section pages still stubs.`,
)
