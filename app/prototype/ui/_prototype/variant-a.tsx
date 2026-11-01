'use client'

// PROTOTYPE — Variant A "Columns + side sheet".
// Lists are horizontal columns. A task opens in a sheet over the board
// (an intercepted route; loading the URL directly gives a full page).
// Reorder via a per-item "⋯" menu: Move up / down, Move to list + position.
// Board management lives on one Settings page with tabs.

import { useState } from 'react'

import { Button } from '@/app/_components/ui/button'

import {
  ActivityFeed,
  AddInline,
  ArchivedBadge,
  Avatar,
  Avatars,
  BoardLog,
  Dialog,
  MemberPicker,
  SignInFields,
  SignUpFields,
  TagChip,
  Toggle,
  UserLog,
  useLoc,
  usePerms,
  type Loc,
} from './shared'
import { activeTaskCount, listsOf, tasksOf, userName, useStore, type Task } from './store'

export const nameA = 'Columns + task dialog'

export function urlA(l: Loc) {
  switch (l.screen) {
    case 'sign-in':
      return '/sign-in'
    case 'sign-up':
      return '/sign-up'
    case 'boards':
      return '/boards'
    case 'board':
      return `/boards/${l.board}`
    case 'task':
      return `/boards/${l.board}/tasks/${l.task}   (dialog over the board via (.)tasks intercept; full page on direct load)`
    case 'settings':
      return `/boards/${l.board}/settings${l.tab && l.tab !== 'general' ? `?tab=${l.tab}` : ''}`
    case 'account':
      return '/account'
  }
}

export function VariantA() {
  const { s } = useStore()
  const { loc } = useLoc()
  if (!s.actorId || loc.screen === 'sign-in' || loc.screen === 'sign-up') return <AuthA />
  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <TopBar />
      {loc.screen === 'boards' && <BoardsA />}
      {(loc.screen === 'board' || loc.screen === 'task') && loc.board && <BoardA boardId={loc.board} />}
      {loc.screen === 'task' && loc.task && loc.board && <TaskSheet boardId={loc.board} taskId={loc.task} />}
      {loc.screen === 'settings' && loc.board && <SettingsA boardId={loc.board} />}
      {loc.screen === 'account' && (
        <main className="mx-auto w-full max-w-2xl space-y-3 p-4 sm:p-6">
          <h1 className="text-xl font-semibold">Your account</h1>
          <h2 className="font-medium">Sign-in history (User log)</h2>
          <UserLog />
        </main>
      )}
    </div>
  )
}

function TopBar() {
  const { s, c } = useStore()
  const { loc, go } = useLoc()
  const board = s.boards.find((b) => b.id === loc.board)
  return (
    <header className="flex h-12 items-center gap-3 border-b bg-white px-4">
      <button className="shrink-0 font-semibold" onClick={() => go({ screen: 'boards' })}>
        ▦<span className="hidden sm:inline"> Taskboard</span>
      </button>
      {board && loc.screen !== 'boards' && (
        <>
          <span className="text-neutral-400">/</span>
          <button className="truncate text-sm" onClick={() => go({ screen: 'board', board: board.id })}>
            {board.name}
          </button>
        </>
      )}
      <details className="relative ml-auto">
        <summary className="flex cursor-pointer list-none items-center rounded-full" aria-label="Account menu">
          <Avatar userId={s.actorId!} size="md" />
        </summary>
        <div
          className="absolute right-0 z-40 mt-2 w-56 rounded-md border bg-white py-1 text-sm shadow-lg"
          onClick={(e) => e.currentTarget.parentElement?.removeAttribute('open')}
        >
          <div className="border-b px-3 py-2">
            <p className="font-medium">{userName(s, s.actorId!)}</p>
            <p className="text-xs text-neutral-500">{s.users.find((u) => u.id === s.actorId)?.email}</p>
          </div>
          <MenuItem onClick={() => go({ screen: 'boards' })}>Your boards</MenuItem>
          <MenuItem onClick={() => go({ screen: 'account' })}>Account</MenuItem>
          <MenuItem
            onClick={() => {
              c.signOut()
              go({ screen: 'sign-in' })
            }}
          >
            Sign out
          </MenuItem>
        </div>
      </details>
    </header>
  )
}

function AuthA() {
  const { loc, go } = useLoc()
  const up = loc.screen === 'sign-up'
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{up ? 'Create your account' : 'Sign in to Taskboard'}</h1>
        {up ? <SignUpFields onDone={() => go({ screen: 'boards' })} /> : <SignInFields onDone={() => go({ screen: 'boards' })} />}
        <p className="text-center text-sm text-neutral-600">
          {up ? 'Already have an account? ' : 'New here? '}
          <button className="font-medium underline" onClick={() => go({ screen: up ? 'sign-in' : 'sign-up' })}>
            {up ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </main>
  )
}

function BoardsA() {
  const { s, c } = useStore()
  const { go } = useLoc()
  const [showArchived, setShowArchived] = useState(false)
  const mine = s.boards.filter((b) => b.members.some((m) => m.userId === s.actorId) && (showArchived || !b.archived))
  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Your boards</h1>
        <Toggle label="Show archived boards" checked={showArchived} onChange={setShowArchived} />
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mine.map((b) => {
          const role = b.members.find((m) => m.userId === s.actorId)!.role
          return (
            <li key={b.id}>
              <button
                onClick={() => go({ screen: 'board', board: b.id })}
                className={`flex h-28 w-full flex-col justify-between rounded-xl border bg-white p-4 text-left shadow-sm hover:shadow ${b.archived ? 'opacity-60' : ''}`}
              >
                <span className="flex items-center gap-2 font-medium">
                  {b.name} {b.archived && <ArchivedBadge />}
                </span>
                <span className="flex items-center justify-between text-xs text-neutral-500">
                  <Avatars ids={b.members.map((m) => m.userId)} />
                  {role}
                </span>
              </button>
            </li>
          )
        })}
        <li className="rounded-xl border border-dashed p-4">
          <p className="mb-2 text-sm font-medium">New board</p>
          <AddInline placeholder="Board name" onAdd={(n) => c.createBoard(n)} />
        </li>
      </ul>
    </main>
  )
}

function BoardA({ boardId }: { boardId: string }) {
  const { s, c } = useStore()
  const { go } = useLoc()
  const { board, canEdit, role } = usePerms(boardId)
  const [showArchived, setShowArchived] = useState(false)
  if (!board || !role) return <p className="p-6">Not found.</p>
  const lists = listsOf(s, boardId, showArchived)
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold">{board.name}</h1>
        {board.archived && <ArchivedBadge />}
        <span className="hidden sm:inline-flex">
          <Avatars ids={board.members.map((m) => m.userId)} />
        </span>
        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <Toggle label="Show archived" checked={showArchived} onChange={setShowArchived} />
          <Button size="sm" variant="outline" aria-label="Board settings" onClick={() => go({ screen: 'settings', board: boardId, tab: 'general' })}>
            ⚙<span className="hidden sm:inline"> Settings</span>
          </Button>
        </div>
      </div>
      {board.archived && (
        <p className="mx-4 mb-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:mx-6">This board is archived and read-only.</p>
      )}
      {/* Mobile only: jump strip, one chip per list. Tapping scrolls that column into view. */}
      <nav aria-label="Lists" className="flex gap-2 overflow-x-auto px-4 pb-2 sm:hidden">
        {lists.map((l) => (
          <a
            key={l.id}
            href={`#list-${l.id}`}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(`list-${l.id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
            }}
            className="shrink-0 rounded-full border bg-white px-3 py-1 text-xs"
          >
            {l.name} <span className="text-neutral-500">{tasksOf(s, l.id, showArchived).length}</span>
          </a>
        ))}
      </nav>
      <div className="flex flex-1 snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-6 sm:snap-none sm:px-6">
        {lists.map((l, i) => {
          const tasks = tasksOf(s, l.id, showArchived)
          const active = activeTaskCount(s, l.id)
          return (
            <section
              key={l.id}
              id={`list-${l.id}`}
              className={`w-[calc(100vw-2.5rem)] shrink-0 snap-center rounded-xl bg-neutral-200/70 p-2 sm:w-72 ${l.archived ? 'opacity-60' : ''}`}
            >
              <header className="flex items-center justify-between px-1 pb-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  {l.name} <span className="font-normal text-neutral-500">{tasks.length}</span>
                  {l.archived && <ArchivedBadge />}
                </h2>
                {canEdit && (
                  <Menu>
                    {!l.archived && (
                      <>
                        <MenuItem disabled={i === 0} onClick={() => c.moveList(l.id, i - 1)}>
                          ← Move left
                        </MenuItem>
                        <MenuItem disabled={i === lists.length - 1} onClick={() => c.moveList(l.id, i + 1)}>
                          Move right →
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            const n = prompt('Rename list', l.name)
                            if (n) c.renameList(l.id, n)
                          }}
                        >
                          Rename
                        </MenuItem>
                      </>
                    )}
                    {l.archived ? (
                      <MenuItem onClick={() => c.setListArchived(l.id, false)}>Restore list</MenuItem>
                    ) : (
                      <MenuItem
                        disabled={active > 0}
                        title={active > 0 ? `Archive or move its ${active} active task(s) first` : undefined}
                        onClick={() => c.setListArchived(l.id, true)}
                      >
                        Archive list{active > 0 && <span className="block text-[11px] text-neutral-500">Needs no active tasks ({active} left)</span>}
                      </MenuItem>
                    )}
                  </Menu>
                )}
              </header>
              <ol className="space-y-2">
                {tasks.map((t, ti) => (
                  <TaskCardA key={t.id} task={t} index={ti} count={tasks.length} canEdit={canEdit && !l.archived} />
                ))}
              </ol>
              {canEdit && !l.archived && <AddInline className="mt-2" placeholder="Add a task" onAdd={(v) => c.createTask(l.id, v)} />}
            </section>
          )
        })}
        {canEdit && (
          <section className="w-[calc(100vw-2.5rem)] shrink-0 snap-center rounded-xl border border-dashed p-2 sm:w-72">
            <AddInline placeholder="Add a list" onAdd={(v) => c.createList(boardId, v)} />
          </section>
        )}
      </div>
    </main>
  )
}

function TaskCardA({ task, index, count, canEdit }: { task: Task; index: number; count: number; canEdit: boolean }) {
  const { s, c } = useStore()
  const { go } = useLoc()
  const board = s.boards.find((b) => b.id === task.boardId)!
  const [moving, setMoving] = useState(false)
  return (
    <li className={`group rounded-lg border bg-white p-2 shadow-sm ${task.archived ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-1">
        <button className="flex-1 text-left text-sm" onClick={() => go({ screen: 'task', board: task.boardId, task: task.id })}>
          {task.title} {task.archived && <ArchivedBadge />}
        </button>
        {canEdit && !task.archived && (
          <Menu>
            <MenuItem disabled={index === 0} onClick={() => c.moveTask(task.id, task.listId, index - 1)}>
              ↑ Move up
            </MenuItem>
            <MenuItem disabled={index === count - 1} onClick={() => c.moveTask(task.id, task.listId, index + 1)}>
              ↓ Move down
            </MenuItem>
            <MenuItem onClick={() => setMoving(true)}>Move to list…</MenuItem>
            <MenuItem onClick={() => c.setTaskArchived(task.id, true)}>Archive</MenuItem>
          </Menu>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="flex flex-wrap gap-1">
          {task.tagIds.map((g) => {
            const tag = board.tags.find((x) => x.id === g)!
            return <TagChip key={g} name={tag.name} color={tag.color} />
          })}
        </span>
        <Avatars ids={task.assigneeIds} />
      </div>
      <MoveDialog task={task} open={moving} onClose={() => setMoving(false)} />
    </li>
  )
}

function MoveDialog({ task, open, onClose }: { task: Task; open: boolean; onClose: () => void }) {
  const { s, c } = useStore()
  const lists = listsOf(s, task.boardId, false)
  const [listId, setListId] = useState(task.listId)
  const targets = tasksOf(s, listId, false).filter((t) => t.id !== task.id)
  const [pos, setPos] = useState(0)
  return (
    <Dialog open={open} onClose={onClose} title={`Move “${task.title}”`}>
      <div className="space-y-3">
        <label className="block text-sm">
          List
          <select className="mt-1 w-full rounded-md border px-2 py-1.5" value={listId} onChange={(e) => (setListId(e.target.value), setPos(0))}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.id === task.listId ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Position
          <select className="mt-1 w-full rounded-md border px-2 py-1.5" value={pos} onChange={(e) => setPos(Number(e.target.value))}>
            {Array.from({ length: targets.length + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}
                {i === 0 ? ' (top)' : i === targets.length ? ' (bottom)' : ` (after “${targets[i - 1]!.title}”)`}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              c.moveTask(task.id, listId, pos)
              onClose()
            }}
          >
            Move
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function TaskSheet({ boardId, taskId }: { boardId: string; taskId: string }) {
  const { s, c } = useStore()
  const { go } = useLoc()
  const { board, canEdit } = usePerms(boardId)
  const task = s.tasks.find((t) => t.id === taskId)
  if (!task || !board) return null
  const list = s.lists.find((l) => l.id === task.listId)!
  const editable = canEdit && !task.archived && !list.archived
  const lists = listsOf(s, boardId, false)
  return (
    // Centered dialog on sm+; full-screen sheet on phones. Esc / backdrop / × close it.
    <div
      className="fixed inset-0 z-30 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-6"
      onClick={() => go({ screen: 'board', board: boardId })}
      onKeyDown={(e) => e.key === 'Escape' && go({ screen: 'board', board: boardId })}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        className="w-full overflow-y-auto bg-white p-4 shadow-2xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-xs text-neutral-500">
          {board.name} · in <span className="font-medium">{list.name}</span>
        </p>
        <div className="mb-4 flex items-start justify-between gap-3">
          <input
            key={task.title}
            defaultValue={task.title}
            disabled={!editable}
            onBlur={(e) => e.target.value !== task.title && c.updateTask(task.id, { title: e.target.value })}
            className="w-full rounded px-1 text-xl font-semibold disabled:bg-transparent"
          />
          <button aria-label="Close" onClick={() => go({ screen: 'board', board: boardId })} className="text-xl text-neutral-500">
            ×
          </button>
        </div>
        {task.archived && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">This task is archived and read-only.</p>}
        <dl className="mb-4 grid grid-cols-[5.5rem_1fr] items-center gap-y-3 text-sm sm:grid-cols-[7rem_1fr]">
          <dt className="text-neutral-500">List</dt>
          <dd>
            <select
              disabled={!editable}
              value={task.listId}
              onChange={(e) => c.moveTask(task.id, e.target.value, 999)}
              className="rounded-md border px-2 py-1"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </dd>
          <dt className="text-neutral-500">Assignees</dt>
          <dd className="flex flex-wrap gap-1">
            {board.members.map((m) => {
              const on = task.assigneeIds.includes(m.userId)
              return (
                <button
                  key={m.userId}
                  disabled={!editable}
                  onClick={() => c.toggleAssignee(task.id, m.userId)}
                  className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-neutral-900 bg-neutral-900 text-white' : 'text-neutral-600'}`}
                >
                  {userName(s, m.userId)}
                </button>
              )
            })}
          </dd>
          <dt className="text-neutral-500">Tags</dt>
          <dd className="flex flex-wrap items-center gap-1">
            {task.tagIds.map((g) => {
              const tag = board.tags.find((x) => x.id === g)!
              return <TagChip key={g} name={tag.name} color={tag.color} onRemove={editable ? () => c.toggleTag(task.id, g) : undefined} />
            })}
            {editable && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value === '__new') {
                    const n = prompt('New tag name')
                    if (n) c.createTag(boardId, n)
                  } else if (e.target.value) c.toggleTag(task.id, e.target.value)
                }}
                className="rounded-md border px-1 py-0.5 text-xs"
              >
                <option value="">+ Tag</option>
                {board.tags
                  .filter((g) => !task.tagIds.includes(g.id))
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                <option value="__new">New tag…</option>
              </select>
            )}
          </dd>
        </dl>
        <label className="mb-6 block text-sm">
          <span className="text-neutral-500">Description</span>
          <textarea
            key={task.description}
            defaultValue={task.description}
            disabled={!editable}
            onBlur={(e) => c.updateTask(task.id, { description: e.target.value })}
            rows={4}
            placeholder="Add a description…"
            className="mt-1 w-full rounded-md border px-2 py-1"
          />
        </label>
        <div className="mb-6">
          {canEdit &&
            (task.archived ? (
              <Button variant="outline" size="sm" disabled={list.archived} onClick={() => c.setTaskArchived(task.id, false)}>
                Restore task{list.archived ? ' (restore its list first)' : ''}
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => c.setTaskArchived(task.id, true)}>
                Archive task
              </Button>
            ))}
        </div>
        <ActivityFeed taskId={task.id} readOnly={!canEdit} />
      </div>
    </div>
  )
}

function SettingsA({ boardId }: { boardId: string }) {
  const { s, c } = useStore()
  const { loc, go } = useLoc()
  const { board, isOwner, canManage, role } = usePerms(boardId)
  const [archiving, setArchiving] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [adding, setAdding] = useState(false)
  if (!board || !role) return <p className="p-6">Not found.</p>
  const tab = loc.tab ?? 'general'
  const tabs = [
    ['general', 'General'],
    ['members', 'Members'],
    ...(isOwner ? [['log', 'Board log']] : []),
  ]
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-semibold">{board.name} · Settings</h1>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => go({ screen: 'settings', board: boardId, tab: k })}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-neutral-900 font-medium' : 'border-transparent text-neutral-500'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'general' && (
        <div className="space-y-8">
          <section className="space-y-2">
            <h2 className="font-medium">Board name</h2>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const v = new FormData(e.currentTarget).get('name') as string
                if (v) c.renameBoard(boardId, v)
              }}
            >
              <input name="name" defaultValue={board.name} disabled={!canManage} className="flex-1 rounded-md border px-3 py-2 text-sm" />
              <Button type="submit" disabled={!canManage}>
                Save
              </Button>
            </form>
            {!isOwner && <p className="text-xs text-neutral-500">Only the Owner can rename the board.</p>}
          </section>
          {isOwner && (
            <section className="space-y-2 rounded-lg border border-red-200 p-4">
              <h2 className="font-medium text-red-700">{board.archived ? 'Restore board' : 'Archive board'}</h2>
              <p className="text-sm text-neutral-600">
                {board.archived
                  ? 'Restoring makes the board editable again for every board member.'
                  : 'Archiving hides the board from everyone’s board list and makes it read-only. Its lists and tasks keep their own state. You can restore it later.'}
              </p>
              {board.archived ? (
                <Button variant="outline" onClick={() => c.setBoardArchived(boardId, false)}>
                  Restore board
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => setArchiving(true)}>
                  Archive board…
                </Button>
              )}
            </section>
          )}
          {!isOwner && (
            <section className="space-y-2 rounded-lg border p-4">
              <h2 className="font-medium">Leave board</h2>
              <Button
                variant="outline"
                onClick={() => {
                  c.leaveBoard(boardId)
                  go({ screen: 'boards' })
                }}
              >
                Leave board
              </Button>
            </section>
          )}
          <Dialog open={archiving} onClose={() => setArchiving(false)} title={`Archive “${board.name}”?`}>
            <p className="mb-3 text-sm text-neutral-600">
              The board becomes read-only and disappears from every board member’s list. Type the board name to confirm.
            </p>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mb-3 w-full rounded-md border px-3 py-2 text-sm" placeholder={board.name} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setArchiving(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={confirmText !== board.name}
                onClick={() => {
                  c.setBoardArchived(boardId, true)
                  setArchiving(false)
                  setConfirmText('')
                }}
              >
                Archive board
              </Button>
            </div>
          </Dialog>
        </div>
      )}

      {tab === 'members' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{board.members.length} board members</h2>
            {canManage && <Button onClick={() => setAdding(true)}>+ Add member</Button>}
          </div>
          <ul className="divide-y rounded-lg border bg-white">
            {board.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm">
                  <span className="font-medium">{userName(s, m.userId)}</span>
                  {m.userId === s.actorId && <span className="text-neutral-500"> (you)</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{m.role}</span>
                  {canManage && m.role === 'Member' && (
                    <Menu>
                      <MenuItem
                        onClick={() => confirm(`Make ${userName(s, m.userId)} the Owner? You become a Member.`) && c.transferOwnership(boardId, m.userId)}
                      >
                        Make Owner…
                      </MenuItem>
                      <MenuItem
                        onClick={() =>
                          confirm(`Remove ${userName(s, m.userId)}? Their assignments pass to you.`) && c.removeMember(boardId, m.userId)
                        }
                      >
                        Remove from board…
                      </MenuItem>
                    </Menu>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {isOwner && <p className="text-xs text-neutral-500">To leave this board, make another board member the Owner first.</p>}
          <Dialog open={adding} onClose={() => setAdding(false)} title="Add a board member">
            {adding && <MemberPicker boardId={boardId} onPicked={() => setAdding(false)} />}
          </Dialog>
        </section>
      )}

      {tab === 'log' && isOwner && <BoardLog boardId={boardId} />}
    </main>
  )
}

// tiny popover menu
function Menu({ children }: { children: React.ReactNode }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded px-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Actions">
        ⋯
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border bg-white py-1 shadow-lg" onClick={(e) => e.currentTarget.parentElement?.removeAttribute('open')}>
        {children}
      </div>
    </details>
  )
}
function MenuItem({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button disabled={disabled} title={title} onClick={onClick} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:text-neutral-400 disabled:hover:bg-transparent">
      {children}
    </button>
  )
}
