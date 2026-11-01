'use client'

// PROTOTYPE — throwaway. Hosts the three variants over one in-memory store so
// switching variant keeps your data, and shows the URL each variant proposes.

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { PrototypeSwitcher } from '@/app/_components/prototype-switcher'

import { useLoc } from './shared'
import { roleOf, StoreProvider, useStore } from './store'
import { nameA, urlA, VariantA } from './variant-a'
import { nameB, urlB, VariantB } from './variant-b'
import { nameC, urlC, VariantC } from './variant-c'

const VARIANTS = [
  { key: 'A', name: nameA, View: VariantA, url: urlA },
  { key: 'B', name: nameB, View: VariantB, url: urlB },
  { key: 'C', name: nameC, View: VariantC, url: urlC },
]

export function PrototypeShell() {
  return (
    <StoreProvider>
      <Inner />
    </StoreProvider>
  )
}

function Inner() {
  const sp = useSearchParams()
  const v = VARIANTS.find((x) => x.key === sp.get('variant')) ?? VARIANTS[0]!
  // globals.css maps --font-sans to itself, so pin a sans stack for the prototype.
  return (
    <div style={{ fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui' }}>
      <ProtoBar url={v.url} />
      <v.View />
      <PrototypeSwitcher variants={VARIANTS.map(({ key, name }) => ({ key, name }))} />
    </div>
  )
}

function ProtoBar({ url }: { url: (l: ReturnType<typeof useLoc>['loc']) => string }) {
  const { s, c } = useStore()
  const { loc, go } = useLoc()
  const [showState, setShowState] = useState(false)
  return (
    <div className="fixed right-3 bottom-16 z-50 w-[26rem] rounded-lg border-2 border-fuchsia-500 bg-white/95 p-2 font-mono text-[11px] shadow-xl">
      <div className="flex items-center gap-2">
        <span className="rounded bg-fuchsia-600 px-1 text-white">PROTOTYPE</span>
        <span className="truncate" title={url(loc)}>{s.actorId ? url(loc) : url({ ...loc, screen: loc.screen === 'sign-up' ? 'sign-up' : 'sign-in' })}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span>actor:</span>
        <select
          value={s.actorId ?? ''}
          onChange={(e) => (e.target.value ? c.signIn(e.target.value) : (c.signOut(), go({ screen: 'sign-in' })))}
          className="rounded border px-1"
        >
          <option value="">(signed out)</option>
          {s.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {loc.board ? ` — ${roleOf(s, loc.board, u.id) ?? 'not a member'}` : ''}
            </option>
          ))}
        </select>
        <button className="ml-auto underline" onClick={() => setShowState((x) => !x)}>
          {showState ? 'hide' : 'show'} state
        </button>
      </div>
      {showState && (
        <pre className="mt-1 max-h-72 overflow-auto rounded bg-neutral-100 p-1">
          {JSON.stringify({ loc, actorId: s.actorId, board: s.boards.find((b) => b.id === loc.board), lists: s.lists.filter((l) => l.boardId === loc.board), task: s.tasks.find((t) => t.id === loc.task), lastEntries: s.entries.slice(-5) }, null, 1)}
        </pre>
      )}
    </div>
  )
}
