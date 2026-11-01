import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

export interface Adr {
  number: string
  title: string
  url: string
}

declare const data: Record<string, Adr>
export { data }

const blob = 'https://github.com/B-Jones-RFD/next-ddd-starter/blob/main/docs/adr'

// Paths starting with "." resolve from this file.
export default {
  watch: ['../../../docs/adr/*.md'],
  load(files: string[]): Record<string, Adr> {
    const adrs: Record<string, Adr> = {}
    for (const file of files) {
      const name = basename(file)
      const number = name.slice(0, 4)
      const heading = /^#\s+(.+)$/m.exec(readFileSync(file, 'utf8'))
      adrs[number] = {
        number,
        title: heading?.[1]?.replaceAll('`', '').trim() ?? name,
        url: `${blob}/${name}`,
      }
    }
    return adrs
  },
}
