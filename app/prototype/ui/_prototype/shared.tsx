'use client'

// PROTOTYPE — throwaway. Small widgets shared by every variant (chips, the
// Activity feed, a dialog, the member picker). Layout is NOT shared: each
// variant owns its own structure.

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/app/_components/ui/button'

import { activityOf, roleOf, userName, useStore, type Entry } from './store'

// ---------- logical location, kept in the query string ----------
export type Screen = 'sign-in' | 'sign-up' | 'boards' | 'board' | 'task' | 'settings' | 'account'
export type Loc = { screen: Screen; board?: string; task?: string; tab?: string; list?: string }

export function useLoc() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const loc: Loc = {
    screen: (sp.get('screen') as Screen) ?? 'boards',
    board: sp.get('board') ?? undefined,
    task: sp.get('task') ?? undefined,
    tab: sp.get('tab') ?? undefined,
    list: sp.get('list') ?? undefined,
  }
  const go = (next: Loc) => {
    const p = new URLSearchParams()
    const v = sp.get('variant')
    if (v) p.set('variant', v)
    p.set('screen', next.screen)
    if (next.board) p.set('board', next.board)
    if (next.task) p.set('task', next.task)
    if (next.tab) p.set('tab', next.tab)
    if (next.list) p.set('list', next.list)
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }
  return { loc, go }
}

// ---------- bits ----------
export function TagChip({ name, color, onRemove }: { name: string; color: string; onRemove?: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {name}
      {onRemove && (
        <button aria-label={`Remove tag ${name}`} onClick={onRemove} className="opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </span>
  )
}

export function Avatar({ userId, size = 'sm', owner = false }: { userId: string; size?: 'sm' | 'md'; owner?: boolean }) {
  const { s } = useStore()
  const n = userName(s, userId)
  const initials = n
    .split(' ')
    .map((p) => p[0])
    .join('')
  return (
    <span className={`relative inline-flex ${owner ? 'z-10' : ''}`}>
      <span
        title={owner ? `${n} (Owner)` : n}
        aria-label={owner ? `${n}, Owner` : n}
        className={`inline-flex items-center justify-center rounded-full bg-neutral-800 font-medium text-white ${owner ? 'ring-2 ring-amber-400' : 'ring-2 ring-white'} ${size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs'}`}
      >
        {initials}
      </span>
      {owner && (
        <span aria-hidden className="absolute -top-1.5 -right-1 text-[10px] leading-none drop-shadow-[0_0_1px_white]">
          👑
        </span>
      )}
    </span>
  )
}

/** Board-member stack: pass ownerId to put the Owner first and mark them. */
export function Avatars({ ids, ownerId }: { ids: string[]; ownerId?: string }) {
  const ordered = ownerId && ids.includes(ownerId) ? [ownerId, ...ids.filter((i) => i !== ownerId)] : ids
  return (
    <span className="flex -space-x-1.5">
      {ordered.map((i) => (
        <Avatar key={i} userId={i} owner={i === ownerId} />
      ))}
    </span>
  )
}

export function Time({ at }: { at: number }) {
  const mins = Math.round((Date.now() - at) / 60_000)
  const label = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.round(mins / 60)}h ago` : `${Math.round(mins / 1440)}d ago`
  return (
    <time className="text-xs text-neutral-500" dateTime={new Date(at).toISOString()} title={new Date(at).toLocaleString()}>
      {label}
    </time>
  )
}

export function ArchivedBadge() {
  return <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">Archived</span>
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-700 select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-neutral-900" />
      {label}
    </label>
  )
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-full max-w-md rounded-xl p-0 shadow-2xl backdrop:bg-black/40">
      <div className="p-5">
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </dialog>
  )
}

// ---------- Activity ----------
function EntryLine({ x }: { x: Entry }) {
  const { s } = useStore()
  if (x.kind === 'comment')
    return (
      <li className="flex gap-2">
        <Avatar userId={x.actorId} />
        <div className="flex-1 rounded-lg border bg-white px-3 py-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{userName(s, x.actorId)}</span>
            <Time at={x.at} />
          </div>
          <p className="text-sm whitespace-pre-wrap">{x.text}</p>
        </div>
      </li>
    )
  return (
    <li className="flex items-baseline gap-2 pl-8 text-sm text-neutral-600">
      <span>
        <span className="font-medium text-neutral-800">{userName(s, x.actorId)}</span> {x.text}
        {x.kind === 'consequence' && <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] uppercase">consequence</span>}
      </span>
      <Time at={x.at} />
    </li>
  )
}

export function ActivityFeed({ taskId, readOnly, newestFirst = false }: { taskId: string; readOnly?: boolean; newestFirst?: boolean }) {
  const { s, c } = useStore()
  const [showReorders, setShowReorders] = useState(false)
  const [text, setText] = useState('')
  const items = activityOf(s, taskId, showReorders)
  const ordered = newestFirst ? [...items].reverse() : items
  const box = !readOnly && (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        c.addComment(taskId, text.trim())
        setText('')
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a comment…"
        rows={2}
        className="flex-1 rounded-md border px-2 py-1 text-sm"
      />
      <Button type="submit" size="sm">
        Comment
      </Button>
    </form>
  )
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Activity</h3>
        <Toggle label="Show reorders" checked={showReorders} onChange={setShowReorders} />
      </div>
      {newestFirst && box}
      <ol className="space-y-2">
        {ordered.map((x) => (
          <EntryLine key={x.id} x={x} />
        ))}
        {ordered.length === 0 && <li className="text-sm text-neutral-500">Nothing yet.</li>}
      </ol>
      {!newestFirst && box}
    </section>
  )
}

export function BoardLog({ boardId }: { boardId: string }) {
  const { s } = useStore()
  const items = s.entries.filter((x) => x.boardId === boardId).sort((a, b) => b.at - a.at)
  return (
    <ol className="divide-y rounded-lg border bg-white">
      {items.map((x) => {
        const task = x.taskId ? s.tasks.find((t) => t.id === x.taskId) : undefined
        return (
          <li key={x.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
            <span>
              <span className="font-medium">{userName(s, x.actorId)}</span>{' '}
              {x.kind === 'comment' ? 'commented' : x.text}
              {task && <span className="text-neutral-500"> · {task.title}</span>}
            </span>
            <Time at={x.at} />
          </li>
        )
      })}
    </ol>
  )
}

export function UserLog() {
  const { s } = useStore()
  const items = s.entries.filter((x) => x.actorId === s.actorId && x.kind === 'session').sort((a, b) => b.at - a.at)
  return (
    <ol className="divide-y rounded-lg border bg-white">
      {items.map((x) => (
        <li key={x.id} className="flex justify-between px-3 py-2 text-sm">
          <span>{x.text}</span>
          <Time at={x.at} />
        </li>
      ))}
    </ol>
  )
}

// ---------- registered-user picker (combobox style) ----------
export function MemberPicker({ boardId, onPicked }: { boardId: string; onPicked?: () => void }) {
  const { s, c } = useStore()
  const [q, setQ] = useState('')
  const board = s.boards.find((b) => b.id === boardId)!
  const candidates = s.users.filter(
    (u) =>
      !board.members.some((m) => m.userId === u.id) &&
      (q === '' || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())),
  )
  return (
    <div className="space-y-2">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search registered users by name or email"
        className="w-full rounded-md border px-3 py-2 text-sm"
        role="combobox"
        aria-expanded
        aria-controls="member-picker-results"
      />
      <ul id="member-picker-results" role="listbox" className="max-h-56 divide-y overflow-auto rounded-md border">
        {candidates.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-2">
              <Avatar userId={u.id} />
              <span>
                <span className="block text-sm font-medium">{u.name}</span>
                <span className="block text-xs text-neutral-500">{u.email}</span>
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                c.addMember(boardId, u.id)
                onPicked?.()
              }}
            >
              Add as Member
            </Button>
          </li>
        ))}
        {candidates.length === 0 && <li className="px-3 py-2 text-sm text-neutral-500">No registered users match. Everyone else is already a board member.</li>}
      </ul>
    </div>
  )
}

// ---------- permission helper ----------
export function usePerms(boardId?: string) {
  const { s } = useStore()
  const board = boardId ? s.boards.find((b) => b.id === boardId) : undefined
  const role = boardId ? roleOf(s, boardId, s.actorId) : null
  return {
    board,
    role,
    isOwner: role === 'Owner',
    canEdit: !!role && !!board && !board.archived,
    canManage: role === 'Owner' && !!board && !board.archived,
  }
}

// ---------- auth forms (fields only; each variant lays them out) ----------
export function SignInFields({ onDone }: { onDone: () => void }) {
  const { s, c } = useStore()
  const [email, setEmail] = useState('ada@example.com')
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const u = s.users.find((x) => x.email === email)
        if (!u) return setError('Email or password is incorrect.')
        c.signIn(u.id)
        onDone()
      }}
    >
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Password" type="password" value="hunter22" onChange={() => {}} hint="Any password works in the prototype." />
      <Button type="submit" className="w-full">
        Sign in
      </Button>
    </form>
  )
}

export function SignUpFields({ onDone }: { onDone: () => void }) {
  const { s, c } = useStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [err, setErr] = useState<Record<string, string>>({})
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const errs: Record<string, string> = {}
        if (!name.trim()) errs.name = 'Enter your name.'
        if (!email.includes('@')) errs.email = 'Enter a valid email.'
        else if (s.users.some((u) => u.email === email)) errs.email = 'An account with this email already exists.'
        setErr(errs)
        if (Object.keys(errs).length) return
        c.signUp(name.trim(), email)
        onDone()
      }}
    >
      <Field label="Name" value={name} onChange={setName} error={err.name} />
      <Field label="Email" type="email" value={email} onChange={setEmail} error={err.email} />
      <Field label="Password" type="password" value="" onChange={() => {}} hint="At least 12 characters." />
      <Button type="submit" className="w-full">
        Create account
      </Button>
    </form>
  )
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  error,
  hint,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  error?: string
  hint?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        defaultValue={type === 'password' ? value : undefined}
        value={type === 'password' ? undefined : value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className="w-full rounded-md border px-3 py-2 text-sm aria-invalid:border-red-500"
      />
      {error && <span className="block text-xs text-red-600">{error}</span>}
      {hint && !error && <span className="block text-xs text-neutral-500">{hint}</span>}
    </label>
  )
}

// ---------- inline "add" input ----------
export function AddInline({ placeholder, onAdd, className = '' }: { placeholder: string; onAdd: (v: string) => void; className?: string }) {
  const [v, setV] = useState('')
  return (
    <form
      className={`flex gap-2 ${className}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (!v.trim()) return
        onAdd(v.trim())
        setV('')
      }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm" />
      <Button type="submit" size="sm" variant="outline">
        Add
      </Button>
    </form>
  )
}
