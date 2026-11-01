// PROTOTYPE — throwaway route for the "UI and screens" wayfinder ticket.
// Three variants of the whole app, switchable via ?variant=A|B|C and the
// floating bar (← / →). All data is in memory; reload resets it.
// Run: npm run prototype:ui, then open http://localhost:3000/prototype/ui

import { Suspense } from 'react'

import { PrototypeShell } from './_prototype/shell'

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6">Loading prototype…</p>}>
      <PrototypeShell />
    </Suspense>
  )
}
