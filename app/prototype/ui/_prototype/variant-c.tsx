'use client'

// PROTOTYPE — Variant C "Three panes".
// Mail-client layout: a rail (boards, then the current board's lists), a
// middle pane of the selected list's tasks, and a right pane holding the open
// task. Each pane maps to a nested layout segment. Reordering uses Alt+↑/↓ on a
// focused task row plus a position stepper in the task pane; moving between
// lists uses a segmented "Status" control. Members, Board log and Archive are
// dialogs reached from the rail. Archive asks for a second click inline.

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
import { activeTaskCount, listsOf, tasksOf, userName, useStore } from './store'

export const nameC = 'Three panes'

export function urlC(l: Loc) {
  switch (l.screen) {
    case 'sign-in':
      return '/sign-in'
    case 'sign-up':
      return '/sign-up'
    case 'boards':
      return '/boards'
    case 'board':
      return `/boards/${l.board}/lists/${l.list ?? '<first>'}`
    case 'task':
      return `/boards/${l.board}/lists/${l.list ?? '<its list>'}/tasks/${l.task}`
    case 'settings':
      return `/boards/${l.board}/lists/${l.list ?? '<first>'}   + ${l.tab ?? 'members'} dialog (not a route)`
    case 'account':
      return '/account'
  }
}

export function VariantC() {
  const { s } = useStore()
  const { loc } = useLoc()
  if (!s.actorId || loc.screen === 'sign-in' || loc.screen === 'sign-up') return <AuthC />
  return (
    <div className="grid h-screen grid-cols-[15rem_22rem_1fr] overflow-hidden bg-white text-sm">
      <Rail />
      {loc.screen === 'account' ? (
        <main className="col-span-2 overflow-y-auto p-8">
          <h1 className="mb-3 text-xl font-semibold">Account</h1>
          <UserLog />
        </main>
      ) : loc.board ? (
        <>
          <TaskColumn boardId={loc.board} />
          <TaskPane boardId={loc.board} />
        </>
      ) : (
        <main className="col-span-2 flex items-center justify-center text-neutral-500">Pick a board from the left, or create one.</main>
      )}
      {loc.screen === 'settings' && loc.board && <BoardDialogs boardId={loc.board} />}
    </div>
  )
}

function AuthC() {
  const { loc, go } = useLoc()
  const up = loc.screen === 'sign-up'
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-20">
      <div className="mx-auto max-w-xs space-y-6">
        <div>
          <p className="text-sm font-semibold tracking-widest text-neutral-500 uppercase">Taskboard</p>
          <h1 className="text-2xl font-semibold">{up ? 'Make an account' : 'Welcome back'}</h1>
        </div>
        {up ? <SignUpFields onDone={() => go({ screen: 'boards' })} /> : <SignInFields onDone={() => go({ screen: 'boards' })} />}
        <button className="text-sm underline" onClick={() => go({ screen: up ? 'sign-in' : 'sign-up' })}>
          {up ? 'I already have an account' : 'I need an account'}
        </button>
      </div>
    </main>
  )
}

function Rail() {
  const { s, c } = useStore()
  const { loc, go } = useLoc()
  const [showArchivedBoards, setShowArchivedBoards] = useState(false)
  const [showArchivedLists, setShowArchivedLists] = useState(false)
  const boards = s.boards.filter((b) => b.members.some((m) => m.userId === s.actorId) && (showArchivedBoards || !b.archived))
  const { board, canEdit, isOwner } = usePerms(loc.board)
  const lists = board ? listsOf(s, board.id, showArchivedLists) : []
  return (
    <nav className="flex flex-col overflow-y-auto border-r bg-neutral-900 p-3 text-neutral-200">
      <p className="mb-1 flex items-center justify-between text-xs text-neutral-500 uppercase">
        Boards
        <label className="flex items-center gap-1 normal-case">
          <input type="checkbox" checked={showArchivedBoards} onChange={(e) => setShowArchivedBoards(e.target.checked)} />
          archived
        </label>
      </p>
      {boards.map((b) => (
        <button
          key={b.id}
          onClick={() => go({ screen: 'board', board: b.id, list: listsOf(s, b.id, false)[0]?.id })}
          className={`truncate rounded px-2 py-1 text-left ${loc.board === b.id ? 'bg-neutral-700 text-white' : 'hover:bg-neutral-800'} ${b.archived ? 'italic opacity-60' : ''}`}
        >
          {b.name}
        </button>
      ))}
      <AddInlineDark placeholder="New board" onAdd={(n) => c.createBoard(n)} />

      {board && (
        <>
          <p className="mt-6 mb-1 flex items-center justify-between text-xs text-neutral-500 uppercase">
            Lists
            <label className="flex items-center gap-1 normal-case">
              <input type="checkbox" checked={showArchivedLists} onChange={(e) => setShowArchivedLists(e.target.checked)} />
              archived
            </label>
          </p>
          {lists.map((l, i) => (
            <div key={l.id} className={`group flex items-center rounded ${loc.list === l.id ? 'bg-neutral-700 text-white' : 'hover:bg-neutral-800'}`}>
              <button className={`flex-1 truncate px-2 py-1 text-left ${l.archived ? 'italic opacity-60' : ''}`} onClick={() => go({ screen: 'board', board: board.id, list: l.id })}>
                {l.name} <span className="text-neutral-500">{activeTaskCount(s, l.id)}</span>
              </button>
              {canEdit && !l.archived && (
                <span className="hidden gap-0.5 pr-1 group-hover:flex">
                  <button aria-label="Move list up" disabled={i === 0} onClick={() => c.moveList(l.id, i - 1)} className="px-1 disabled:opacity-20">
                    ↑
                  </button>
                  <button aria-label="Move list down" disabled={i === lists.length - 1} onClick={() => c.moveList(l.id, i + 1)} className="px-1 disabled:opacity-20">
                    ↓
                  </button>
                </span>
              )}
            </div>
          ))}
          {canEdit && <AddInlineDark placeholder="New list" onAdd={(n) => c.createList(board.id, n)} />}

          <div className="mt-6 space-y-1 border-t border-neutral-700 pt-3">
            <button className="block w-full px-2 py-1 text-left hover:bg-neutral-800" onClick={() => go({ ...loc, screen: 'settings', tab: 'members' })}>
              Members · {board.members.length}
            </button>
            {isOwner && (
              <button className="block w-full px-2 py-1 text-left hover:bg-neutral-800" onClick={() => go({ ...loc, screen: 'settings', tab: 'log' })}>
                Board log
              </button>
            )}
            {isOwner && (
              <button className="block w-full px-2 py-1 text-left hover:bg-neutral-800" onClick={() => go({ ...loc, screen: 'settings', tab: 'board' })}>
                Board settings
              </button>
            )}
          </div>
        </>
      )}
      <div className="mt-auto flex items-center gap-2 border-t border-neutral-700 pt-3">
        <Avatar userId={s.actorId!} />
        <button className="flex-1 truncate text-left" onClick={() => go({ screen: 'account' })}>
          {userName(s, s.actorId!)}
        </button>
        <button
          className="text-xs text-neutral-400"
          onClick={() => {
            c.signOut()
            go({ screen: 'sign-in' })
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}

function AddInlineDark({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) onAdd(v.trim())
        setV('')
      }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={`+ ${placeholder}`} className="mt-1 w-full rounded bg-transparent px-2 py-1 placeholder:text-neutral-500 focus:bg-neutral-800" />
    </form>
  )
}

function TaskColumn({ boardId }: { boardId: string }) {
  const { s, c } = useStore()
  const { loc, go } = useLoc()
  const { board, canEdit } = usePerms(boardId)
  const [showArchived, setShowArchived] = useState(false)
  if (!board) return null
  const listId = loc.list ?? listsOf(s, boardId, false)[0]?.id
  const list = s.lists.find((l) => l.id === listId)
  if (!list) return <section className="border-r p-4 text-neutral-500">No lists yet.</section>
  const tasks = tasksOf(s, list.id, showArchived)
  const active = activeTaskCount(s, list.id)
  const editable = canEdit && !list.archived
  return (
    <section className="flex flex-col overflow-hidden border-r bg-neutral-50">
      <header className="space-y-2 border-b bg-white p-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{list.name}</h2>
          {list.archived && <ArchivedBadge />}
          {board.archived && <ArchivedBadge />}
          <span className="ml-auto">
            {canEdit &&
              (list.archived ? (
                <Button size="xs" variant="outline" onClick={() => c.setListArchived(list.id, false)}>
                  Restore list
                </Button>
              ) : (
                <Button size="xs" variant="ghost" disabled={active > 0} title={active > 0 ? `${active} active task(s) — archive or move them first` : undefined} onClick={() => c.setListArchived(list.id, true)}>
                  Archive list
                </Button>
              ))}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <Toggle label="Show archived tasks" checked={showArchived} onChange={setShowArchived} />
          {editable && <span className="text-[11px] text-neutral-400">Alt + ↑/↓ to reorder</span>}
        </div>
      </header>
      <ol className="flex-1 overflow-y-auto">
        {tasks.map((t, i) => (
          <li key={t.id}>
            <button
              onClick={() => go({ screen: 'task', board: boardId, list: list.id, task: t.id })}
              onKeyDown={(e) => {
                if (!editable || t.archived || !e.altKey) return
                if (e.key === 'ArrowUp' && i > 0) (e.preventDefault(), c.moveTask(t.id, list.id, i - 1))
                if (e.key === 'ArrowDown' && i < tasks.length - 1) (e.preventDefault(), c.moveTask(t.id, list.id, i + 1))
              }}
              className={`block w-full border-b px-3 py-2 text-left focus:outline-2 focus:outline-neutral-900 ${loc.task === t.id ? 'bg-white shadow-[inset_3px_0_0_#171717]' : 'hover:bg-white'} ${t.archived ? 'opacity-50' : ''}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  {t.title} {t.archived && <ArchivedBadge />}
                </span>
                <Avatars ids={t.assigneeIds} />
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                {t.tagIds.map((g) => {
                  const tag = board.tags.find((x) => x.id === g)!
                  return <TagChip key={g} name={tag.name} color={tag.color} />
                })}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {editable && (
        <div className="border-t bg-white p-2">
          <AddInline placeholder="New task" onAdd={(v) => c.createTask(list.id, v)} />
        </div>
      )}
    </section>
  )
}

function TaskPane({ boardId }: { boardId: string }) {
  const { s, c } = useStore()
  const { loc } = useLoc()
  const { board, canEdit } = usePerms(boardId)
  const [tab, setTab] = useState<'details' | 'activity'>('details')
  const task = s.tasks.find((t) => t.id === loc.task)
  if (!board || !task) return <main className="flex items-center justify-center text-neutral-400">Select a task.</main>
  const list = s.lists.find((l) => l.id === task.listId)!
  const editable = canEdit && !task.archived && !list.archived
  const lists = listsOf(s, boardId, false)
  const siblings = tasksOf(s, task.listId, false)
  const index = siblings.findIndex((t) => t.id === task.id)
  return (
    <main className="overflow-y-auto">
      <div className="space-y-4 border-b p-6">
        <input
          key={task.title}
          defaultValue={task.title}
          disabled={!editable}
          onBlur={(e) => e.target.value !== task.title && c.updateTask(task.id, { title: e.target.value })}
          className="w-full text-2xl font-semibold disabled:bg-transparent"
        />
        <div>
          <p className="mb-1 text-xs text-neutral-500">Status (its list)</p>
          <div role="radiogroup" className="inline-flex flex-wrap rounded-lg border p-0.5">
            {lists.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={l.id === task.listId}
                disabled={!editable}
                onClick={() => c.moveTask(task.id, l.id, 999)}
                className="rounded-md px-3 py-1 aria-checked:bg-neutral-900 aria-checked:text-white disabled:opacity-60"
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
        {editable && index >= 0 && (
          <div className="flex items-center gap-1">
            <span className="mr-2 text-xs text-neutral-500">
              Position {index + 1} of {siblings.length}
            </span>
            <Button size="xs" variant="outline" disabled={index === 0} onClick={() => c.moveTask(task.id, task.listId, 0)}>
              ⇈ Top
            </Button>
            <Button size="xs" variant="outline" disabled={index === 0} onClick={() => c.moveTask(task.id, task.listId, index - 1)}>
              ↑
            </Button>
            <Button size="xs" variant="outline" disabled={index === siblings.length - 1} onClick={() => c.moveTask(task.id, task.listId, index + 1)}>
              ↓
            </Button>
            <Button size="xs" variant="outline" disabled={index === siblings.length - 1} onClick={() => c.moveTask(task.id, task.listId, siblings.length)}>
              ⇊ Bottom
            </Button>
          </div>
        )}
      </div>
      <div role="tablist" className="flex gap-4 border-b px-6">
        {(['details', 'activity'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="-mb-px border-b-2 border-transparent py-2 capitalize aria-selected:border-neutral-900 aria-selected:font-medium">
            {k}
          </button>
        ))}
      </div>
      <div className="p-6">
        {tab === 'details' ? (
          <div className="space-y-5">
            {task.archived && <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">Archived — read-only.</p>}
            <textarea
              key={task.description}
              defaultValue={task.description}
              disabled={!editable}
              onBlur={(e) => c.updateTask(task.id, { description: e.target.value })}
              rows={5}
              placeholder="Description"
              className="w-full rounded-md border p-2"
            />
            <div>
              <p className="mb-1 text-xs text-neutral-500">Tags — click to toggle</p>
              <div className="flex flex-wrap gap-1">
                {board.tags.map((g) => {
                  const on = task.tagIds.includes(g.id)
                  return (
                    <button key={g.id} disabled={!editable} onClick={() => c.toggleTag(task.id, g.id)} className={on ? '' : 'opacity-35 grayscale'}>
                      <TagChip name={g.name} color={g.color} />
                    </button>
                  )
                })}
                {editable && (
                  <button
                    className="rounded-full border border-dashed px-2 text-xs"
                    onClick={() => {
                      const n = prompt('New tag')
                      if (n) c.createTag(boardId, n)
                    }}
                  >
                    + tag
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-500">Assignees — click to toggle</p>
              <div className="flex flex-wrap gap-2">
                {board.members.map((m) => (
                  <button key={m.userId} disabled={!editable} onClick={() => c.toggleAssignee(task.id, m.userId)} className={`flex items-center gap-1 ${task.assigneeIds.includes(m.userId) ? '' : 'opacity-35'}`}>
                    <Avatar userId={m.userId} />
                    {userName(s, m.userId)}
                  </button>
                ))}
              </div>
            </div>
            {canEdit && (
              <Button size="sm" variant={task.archived ? 'outline' : 'destructive'} disabled={task.archived && list.archived} onClick={() => c.setTaskArchived(task.id, !task.archived)}>
                {task.archived ? 'Restore task' : 'Archive task'}
              </Button>
            )}
          </div>
        ) : (
          <ActivityFeed taskId={task.id} readOnly={!canEdit} />
        )}
      </div>
    </main>
  )
}

function BoardDialogs({ boardId }: { boardId: string }) {
  const { s, c } = useStore()
  const { loc, go } = useLoc()
  const { board, canManage, isOwner } = usePerms(boardId)
  const [armed, setArmed] = useState(false)
  if (!board) return null
  const close = () => go({ ...loc, screen: loc.task ? 'task' : 'board', tab: undefined })
  const tab = loc.tab ?? 'members'
  return (
    <Dialog open onClose={close} title={tab === 'members' ? 'Board members' : tab === 'log' ? 'Board log' : 'Board settings'}>
      {tab === 'members' && (
        <div className="space-y-4">
          <ul className="space-y-2">
            {board.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2">
                <Avatar userId={m.userId} />
                <span className="flex-1">{userName(s, m.userId)}</span>
                <span className="text-xs text-neutral-500">{m.role}</span>
                {canManage && m.role === 'Member' && (
                  <>
                    <Button size="xs" variant="ghost" onClick={() => confirm(`Make ${userName(s, m.userId)} Owner?`) && c.transferOwnership(boardId, m.userId)}>
                      Make Owner
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => c.removeMember(boardId, m.userId)}>
                      Remove
                    </Button>
                  </>
                )}
                {!isOwner && m.userId === s.actorId && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      c.leaveBoard(boardId)
                      go({ screen: 'boards' })
                    }}
                  >
                    Leave
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium">Add a registered user</p>
              <MemberPicker boardId={boardId} />
            </div>
          )}
        </div>
      )}
      {tab === 'log' && isOwner && (
        <div className="max-h-96 overflow-y-auto">
          <BoardLog boardId={boardId} />
        </div>
      )}
      {tab === 'board' && isOwner && (
        <div className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const v = new FormData(e.currentTarget).get('name') as string
              if (v) c.renameBoard(boardId, v)
            }}
          >
            <input name="name" defaultValue={board.name} disabled={board.archived} className="flex-1 rounded-md border px-2 py-1" />
            <Button type="submit" size="sm" disabled={board.archived}>
              Rename
            </Button>
          </form>
          {board.archived ? (
            <Button variant="outline" onClick={() => c.setBoardArchived(boardId, false)}>
              Restore board
            </Button>
          ) : (
            <div className="rounded-md border border-red-200 p-3">
              <p className="mb-2 text-neutral-600">Archived boards are read-only and hidden from every board member’s list.</p>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!armed) return setArmed(true)
                  c.setBoardArchived(boardId, true)
                  setArmed(false)
                }}
                onBlur={() => setArmed(false)}
              >
                {armed ? 'Click again to archive' : 'Archive board'}
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={close}>
          Close
        </Button>
      </div>
    </Dialog>
  )
}
