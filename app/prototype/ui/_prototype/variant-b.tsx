'use client'

// PROTOTYPE — Variant B "Outline + full pages".
// A board is a vertical outline: each list is a section with a table of
// tasks. Reorder and "Move to list" controls are inline on every row
// (▲ ▼ and a list select), with no menus. A task is its own full page with Activity
// beside it. Members and Board log are separate pages. Sign-in and sign-up
// share one page with tabs.

import { useState } from 'react'

import { Button } from '@/app/_components/ui/button'

import {
  ActivityFeed,
  AddInline,
  ArchivedBadge,
  Avatars,
  BoardLog,
  Dialog,
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

export const nameB = 'Outline + full pages'

export function urlB(l: Loc) {
  switch (l.screen) {
    case 'sign-in':
      return '/welcome'
    case 'sign-up':
      return '/welcome?mode=sign-up'
    case 'boards':
      return '/'
    case 'board':
      return `/b/${l.board}`
    case 'task':
      return `/b/${l.board}/t/${l.task}`
    case 'settings':
      return l.tab === 'log' ? `/b/${l.board}/log` : `/b/${l.board}/members`
    case 'account':
      return '/me'
  }
}

export function VariantB() {
  const { s } = useStore()
  const { loc } = useLoc()
  if (!s.actorId || loc.screen === 'sign-in' || loc.screen === 'sign-up') return <AuthB />
  return (
    <div className="min-h-screen bg-white">
      <SideNavB />
      <div className="pl-56">
        {loc.screen === 'boards' && <BoardsB />}
        {loc.screen === 'board' && loc.board && <BoardB boardId={loc.board} />}
        {loc.screen === 'task' && loc.board && loc.task && <TaskPageB boardId={loc.board} taskId={loc.task} />}
        {loc.screen === 'settings' && loc.board && (loc.tab === 'log' ? <LogPageB boardId={loc.board} /> : <MembersB boardId={loc.board} />)}
        {loc.screen === 'account' && (
          <main className="max-w-2xl space-y-3 p-8">
            <h1 className="text-2xl font-semibold">Me</h1>
            <h2 className="font-medium">Sign-in history</h2>
            <UserLog />
          </main>
        )}
      </div>
    </div>
  )
}

function SideNavB() {
  const { s, c } = useStore()
  const { loc, go } = useLoc()
  const mine = s.boards.filter((b) => !b.archived && b.members.some((m) => m.userId === s.actorId))
  return (
    <nav className="fixed inset-y-0 left-0 flex w-56 flex-col border-r bg-neutral-50 p-3 text-sm">
      <button className="mb-4 px-2 text-left text-base font-bold" onClick={() => go({ screen: 'boards' })}>
        Taskboard
      </button>
      <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Boards</p>
      {mine.map((b) => (
        <button
          key={b.id}
          onClick={() => go({ screen: 'board', board: b.id })}
          className={`rounded px-2 py-1 text-left ${loc.board === b.id ? 'bg-neutral-200 font-medium' : 'hover:bg-neutral-100'}`}
        >
          {b.name}
        </button>
      ))}
      <div className="mt-auto space-y-1 border-t pt-3">
        <button className="block px-2 text-left" onClick={() => go({ screen: 'account' })}>
          {userName(s, s.actorId!)}
        </button>
        <button
          className="block px-2 text-left text-neutral-500"
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

function AuthB() {
  const { loc, go } = useLoc()
  const up = loc.screen === 'sign-up'
  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="hidden flex-col justify-end bg-neutral-900 p-10 text-white md:flex">
        <p className="text-3xl font-semibold">Taskboard</p>
        <p className="text-neutral-400">Boards, lists and tasks for small teams.</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-5">
          <div role="tablist" className="grid grid-cols-2 rounded-lg bg-neutral-100 p-1 text-sm">
            {(['sign-in', 'sign-up'] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={loc.screen === k || (k === 'sign-in' && !up)}
                onClick={() => go({ screen: k })}
                className="rounded-md py-1.5 aria-selected:bg-white aria-selected:shadow-sm"
              >
                {k === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
          {up ? <SignUpFields onDone={() => go({ screen: 'boards' })} /> : <SignInFields onDone={() => go({ screen: 'boards' })} />}
        </div>
      </div>
    </main>
  )
}

function BoardsB() {
  const { s, c } = useStore()
  const { go } = useLoc()
  const [showArchived, setShowArchived] = useState(false)
  const mine = s.boards.filter((b) => b.members.some((m) => m.userId === s.actorId) && (showArchived || !b.archived))
  return (
    <main className="max-w-4xl space-y-4 p-8">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Boards</h1>
        <Toggle label="Show archived" checked={showArchived} onChange={setShowArchived} />
      </div>
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-neutral-500 uppercase">
          <tr>
            <th className="py-2">Name</th>
            <th>Your role</th>
            <th>Board members</th>
            <th className="text-right">Active tasks</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {mine.map((b) => (
            <tr key={b.id} className={`cursor-pointer hover:bg-neutral-50 ${b.archived ? 'text-neutral-400' : ''}`} onClick={() => go({ screen: 'board', board: b.id })}>
              <td className="py-2 font-medium">
                {b.name} {b.archived && <ArchivedBadge />}
              </td>
              <td>{b.members.find((m) => m.userId === s.actorId)!.role}</td>
              <td>
                <Avatars ids={b.members.map((m) => m.userId)} />
              </td>
              <td className="text-right">{s.tasks.filter((t) => t.boardId === b.id && !t.archived).length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <AddInline className="max-w-sm" placeholder="New board name" onAdd={(n) => c.createBoard(n)} />
    </main>
  )
}

function BoardB({ boardId }: { boardId: string }) {
  const { s, c } = useStore()
  const { go } = useLoc()
  const { board, canEdit, isOwner, canManage, role } = usePerms(boardId)
  const [showArchived, setShowArchived] = useState(false)
  const [archiving, setArchiving] = useState(false)
  if (!board || !role) return <p className="p-8">Not found.</p>
  const lists = listsOf(s, boardId, showArchived)
  const allLists = listsOf(s, boardId, false)
  return (
    <main className="max-w-5xl p-8">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{board.name}</h1>
        {board.archived && <ArchivedBadge />}
        <div className="ml-auto flex items-center gap-2">
          <Toggle label="Show archived" checked={showArchived} onChange={setShowArchived} />
          <Button size="sm" variant="outline" onClick={() => go({ screen: 'settings', board: boardId, tab: 'members' })}>
            Members ({board.members.length})
          </Button>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => go({ screen: 'settings', board: boardId, tab: 'log' })}>
              Board log
            </Button>
          )}
          {isOwner &&
            (board.archived ? (
              <Button size="sm" variant="outline" onClick={() => c.setBoardArchived(boardId, false)}>
                Restore board
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setArchiving(true)}>
                Archive board
              </Button>
            ))}
        </div>
      </header>
      {board.archived && <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Archived: read-only until the Owner restores it.</p>}

      <div className="space-y-8">
        {lists.map((l, i) => {
          const tasks = tasksOf(s, l.id, showArchived)
          const active = activeTaskCount(s, l.id)
          const editable = canEdit && !l.archived
          return (
            <section key={l.id} className={l.archived ? 'opacity-60' : ''}>
              <div className="mb-1 flex items-center gap-2 border-b pb-1">
                {editable && (
                  <span className="flex flex-col text-[10px] leading-none">
                    <button aria-label="Move list up" disabled={i === 0} onClick={() => c.moveList(l.id, i - 1)} className="disabled:opacity-25">
                      ▲
                    </button>
                    <button aria-label="Move list down" disabled={i === lists.length - 1} onClick={() => c.moveList(l.id, i + 1)} className="disabled:opacity-25">
                      ▼
                    </button>
                  </span>
                )}
                <h2 className="text-lg font-semibold">{l.name}</h2>
                <span className="text-sm text-neutral-500">{tasks.length}</span>
                {l.archived && <ArchivedBadge />}
                {canEdit && (
                  <span className="ml-auto text-xs">
                    {l.archived ? (
                      <button className="underline" onClick={() => c.setListArchived(l.id, false)}>
                        Restore list
                      </button>
                    ) : active > 0 ? (
                      <span className="text-neutral-400" title="A list can be archived only when none of its tasks are active">
                        Archive list (needs 0 active tasks)
                      </span>
                    ) : (
                      <button className="underline" onClick={() => c.setListArchived(l.id, true)}>
                        Archive list
                      </button>
                    )}
                  </span>
                )}
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {tasks.map((t, ti) => (
                    <tr key={t.id} className={t.archived ? 'text-neutral-400' : ''}>
                      <td className="w-14 py-1.5">
                        {editable && !t.archived && (
                          <span className="flex gap-1">
                            <button aria-label="Move up" disabled={ti === 0} onClick={() => c.moveTask(t.id, l.id, ti - 1)} className="rounded border px-1 disabled:opacity-25">
                              ▲
                            </button>
                            <button aria-label="Move down" disabled={ti === tasks.length - 1} onClick={() => c.moveTask(t.id, l.id, ti + 1)} className="rounded border px-1 disabled:opacity-25">
                              ▼
                            </button>
                          </span>
                        )}
                      </td>
                      <td>
                        <button className="text-left font-medium hover:underline" onClick={() => go({ screen: 'task', board: boardId, task: t.id })}>
                          {t.title}
                        </button>{' '}
                        {t.archived && <ArchivedBadge />}
                      </td>
                      <td className="w-48">
                        <span className="flex flex-wrap gap-1">
                          {t.tagIds.map((g) => {
                            const tag = board.tags.find((x) => x.id === g)!
                            return <TagChip key={g} name={tag.name} color={tag.color} />
                          })}
                        </span>
                      </td>
                      <td className="w-20">
                        <Avatars ids={t.assigneeIds} />
                      </td>
                      <td className="w-40">
                        {editable && !t.archived && (
                          <select
                            aria-label="Move to list"
                            value={l.id}
                            onChange={(e) => c.moveTask(t.id, e.target.value, 999)}
                            className="w-full rounded border px-1 py-0.5 text-xs"
                          >
                            {allLists.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.id === l.id ? `In ${x.name}` : `Move to ${x.name}`}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="w-20 text-right text-xs">
                        {canEdit &&
                          (t.archived ? (
                            !l.archived && (
                              <button className="underline" onClick={() => c.setTaskArchived(t.id, false)}>
                                Restore
                              </button>
                            )
                          ) : (
                            <button className="text-neutral-500 underline" onClick={() => c.setTaskArchived(t.id, true)}>
                              Archive
                            </button>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {editable && <AddInline className="mt-2 max-w-md" placeholder={`Add a task to ${l.name}`} onAdd={(v) => c.createTask(l.id, v)} />}
            </section>
          )
        })}
        {canEdit && <AddInline className="max-w-md" placeholder="Add a list" onAdd={(v) => c.createList(boardId, v)} />}
      </div>

      <Dialog open={archiving} onClose={() => setArchiving(false)} title="Archive this board?">
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-neutral-600">
          <li>It disappears from the board list for all {board.members.length} board members.</li>
          <li>Everything on it becomes read-only.</li>
          <li>Lists and tasks keep their own state, so restoring brings it all back as it was.</li>
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setArchiving(false)}>
            Keep board
          </Button>
          <Button
            variant="destructive"
            disabled={!canManage}
            onClick={() => {
              c.setBoardArchived(boardId, true)
              setArchiving(false)
            }}
          >
            Archive board
          </Button>
        </div>
      </Dialog>
    </main>
  )
}

function TaskPageB({ boardId, taskId }: { boardId: string; taskId: string }) {
  const { s, c } = useStore()
  const { go } = useLoc()
  const { board, canEdit } = usePerms(boardId)
  const task = s.tasks.find((t) => t.id === taskId)
  if (!task || !board) return <p className="p-8">Not found.</p>
  const list = s.lists.find((l) => l.id === task.listId)!
  const editable = canEdit && !task.archived && !list.archived
  const siblings = tasksOf(s, task.listId, false)
  const index = siblings.findIndex((t) => t.id === task.id)
  return (
    <main className="p-8">
      <button className="mb-4 text-sm text-neutral-500 hover:underline" onClick={() => go({ screen: 'board', board: boardId })}>
        ← {board.name} / {list.name}
      </button>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <input
            key={task.title}
            defaultValue={task.title}
            disabled={!editable}
            onBlur={(e) => e.target.value !== task.title && c.updateTask(task.id, { title: e.target.value })}
            className="w-full text-3xl font-semibold disabled:bg-transparent"
          />
          {task.archived && <ArchivedBadge />}
          <textarea
            key={task.description}
            defaultValue={task.description}
            disabled={!editable}
            onBlur={(e) => c.updateTask(task.id, { description: e.target.value })}
            rows={8}
            placeholder="Description"
            className="w-full rounded-md border p-3 text-sm"
          />
          <div className="grid grid-cols-2 gap-6 text-sm">
            <fieldset disabled={!editable} className="space-y-1">
              <legend className="mb-1 font-medium">Tags</legend>
              {board.tags.map((g) => (
                <label key={g.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={task.tagIds.includes(g.id)} onChange={() => c.toggleTag(task.id, g.id)} />
                  <TagChip name={g.name} color={g.color} />
                </label>
              ))}
              <AddInline placeholder="New tag" onAdd={(n) => c.createTag(boardId, n)} />
            </fieldset>
            <fieldset disabled={!editable} className="space-y-1">
              <legend className="mb-1 font-medium">Assignees</legend>
              {board.members.map((m) => (
                <label key={m.userId} className="flex items-center gap-2">
                  <input type="checkbox" checked={task.assigneeIds.includes(m.userId)} onChange={() => c.toggleAssignee(task.id, m.userId)} />
                  {userName(s, m.userId)}
                </label>
              ))}
            </fieldset>
          </div>
          <fieldset disabled={!editable} className="flex items-end gap-3 rounded-lg bg-neutral-50 p-3 text-sm">
            <label>
              <span className="block text-xs text-neutral-500">List</span>
              <select value={task.listId} onChange={(e) => c.moveTask(task.id, e.target.value, 999)} className="rounded border px-2 py-1">
                {listsOf(s, boardId, false).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-xs text-neutral-500">Position</span>
              <input
                type="number"
                min={1}
                max={siblings.length}
                key={index}
                defaultValue={index + 1}
                onBlur={(e) => c.moveTask(task.id, task.listId, Number(e.target.value) - 1)}
                className="w-16 rounded border px-2 py-1"
              />
              <span className="ml-1 text-xs text-neutral-500">of {siblings.length}</span>
            </label>
            <span className="ml-auto">
              {canEdit &&
                (task.archived ? (
                  <Button size="sm" variant="outline" disabled={list.archived} onClick={() => c.setTaskArchived(task.id, false)}>
                    Restore
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => c.setTaskArchived(task.id, true)}>
                    Archive task
                  </Button>
                ))}
            </span>
          </fieldset>
        </div>
        <aside className="lg:border-l lg:pl-8">
          <ActivityFeed taskId={task.id} readOnly={!canEdit} newestFirst />
        </aside>
      </div>
    </main>
  )
}

function MembersB({ boardId }: { boardId: string }) {
  const { s, c } = useStore()
  const { go } = useLoc()
  const { board, canManage, isOwner, role } = usePerms(boardId)
  const [pick, setPick] = useState('')
  if (!board || !role) return <p className="p-8">Not found.</p>
  const others = s.users.filter((u) => !board.members.some((m) => m.userId === u.id))
  return (
    <main className="max-w-3xl space-y-6 p-8">
      <button className="text-sm text-neutral-500 hover:underline" onClick={() => go({ screen: 'board', board: boardId })}>
        ← {board.name}
      </button>
      <h1 className="text-2xl font-semibold">Board members</h1>
      {canManage && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (pick) c.addMember(boardId, pick)
            setPick('')
          }}
        >
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1 rounded-md border px-2 py-2 text-sm">
            <option value="">Choose a registered user…</option>
            {others.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.email}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!pick}>
            Add as Member
          </Button>
        </form>
      )}
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-neutral-500 uppercase">
          <tr>
            <th className="py-2">Name</th>
            <th>Email</th>
            <th>Role</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y">
          {board.members.map((m) => {
            const u = s.users.find((x) => x.id === m.userId)!
            return (
              <tr key={m.userId}>
                <td className="py-2 font-medium">{u.name}</td>
                <td className="text-neutral-500">{u.email}</td>
                <td>
                  {canManage && m.role === 'Member' ? (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        e.target.value === 'Owner' &&
                        confirm(`Transfer ownership to ${u.name}? You will become a Member and lose board management.`) &&
                        c.transferOwnership(boardId, m.userId)
                      }
                      className="rounded border px-1 py-0.5"
                    >
                      <option>Member</option>
                      <option>Owner</option>
                    </select>
                  ) : (
                    m.role
                  )}
                </td>
                <td className="text-right">
                  {canManage && m.role === 'Member' && (
                    <button className="text-red-600 underline" onClick={() => confirm(`Remove ${u.name}? Their assignments pass to you.`) && c.removeMember(boardId, m.userId)}>
                      Remove
                    </button>
                  )}
                  {!isOwner && m.userId === s.actorId && (
                    <button
                      className="underline"
                      onClick={() => {
                        c.leaveBoard(boardId)
                        go({ screen: 'boards' })
                      }}
                    >
                      Leave board
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </main>
  )
}

function LogPageB({ boardId }: { boardId: string }) {
  const { go } = useLoc()
  const { board, isOwner } = usePerms(boardId)
  if (!board || !isOwner) return <p className="p-8">Not found.</p>
  return (
    <main className="max-w-3xl space-y-4 p-8">
      <button className="text-sm text-neutral-500 hover:underline" onClick={() => go({ screen: 'board', board: boardId })}>
        ← {board.name}
      </button>
      <h1 className="text-2xl font-semibold">Board log</h1>
      <BoardLog boardId={boardId} />
    </main>
  )
}
