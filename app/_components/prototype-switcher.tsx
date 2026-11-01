'use client'

// PROTOTYPE tooling — floating variant switcher for throwaway UI prototypes.
// Never rendered in production builds.

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export function PrototypeSwitcher({ variants }: { variants: { key: string; name: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const current = sp.get('variant') ?? variants[0]!.key
  const i = Math.max(0, variants.findIndex((v) => v.key === current))

  const go = (d: number) => {
    const next = variants[(i + d + variants.length) % variants.length]!
    const p = new URLSearchParams(sp.toString())
    p.set('variant', next.key)
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, select, [contenteditable]') || t.closest('dialog'))) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (process.env.NODE_ENV === 'production') return null
  const v = variants[i]!
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-600 px-2 py-1 text-sm font-medium text-white shadow-xl ring-4 ring-fuchsia-300/50">
      <button aria-label="Previous variant" onClick={() => go(-1)} className="rounded-full px-2 py-1 hover:bg-white/20">←</button>
      <span className="px-2">{v.key} ({v.name})</span>
      <button aria-label="Next variant" onClick={() => go(1)} className="rounded-full px-2 py-1 hover:bg-white/20">→</button>
    </div>
  )
}
