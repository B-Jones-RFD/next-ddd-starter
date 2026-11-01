'use client'

// PROTOTYPE — throwaway. In-memory stand-in for the boards/identity/audit
// contexts so the UI variants can be judged with real-ish behaviour.
// Nothing here is production code; the rules mirror the glossaries loosely.

import { createContext, useContext, useState, type ReactNode } from 'react'

export type Role = 'Owner' | 'Member'
export type User = { id: string; name: string; email: string }
export type Tag = { id: string; name: string; color: string }
export type Board = {
  id: string
  name: string
  archived: boolean
  members: { userId: string; role: Role }[]
  tags: Tag[]
}
export type List = { id: string; boardId: string; name: string; archived: boolean; position: number }
export type Task = {
  id: string
  boardId: string
  listId: string
  title: string
  description: string
  archived: boolean
  position: number
  tagIds: string[]
  assigneeIds: string[]
}
export type Entry = {
  id: string
  boardId?: string
  taskId?: string
  actorId: string
  text: string
  at: number
  kind: 'change' | 'comment' | 'reorder' | 'consequence' | 'session'
}
export type State = {
  actorId: string | null
  users: User[]
  boards: Board[]
  lists: List[]
  tasks: Task[]
  entries: Entry[]
}

const T0 = Date.now() - 1000 * 60 * 60 * 26
let seq = 100
const id = (p: string) => `${p}${++seq}`

const seed: State = {
  actorId: 'u1',
  users: [
    { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' },
    { id: 'u2', name: 'Grace Hopper', email: 'grace@example.com' },
    { id: 'u3', name: 'Alan Turing', email: 'alan@example.com' },
    { id: 'u4', name: 'Katherine Johnson', email: 'katherine@example.com' },
    { id: 'u5', name: 'Edsger Dijkstra', email: 'edsger@example.com' },
  ],
  boards: [
    {
      id: 'b1',
      name: 'Website relaunch',
      archived: false,
      members: [
        { userId: 'u1', role: 'Owner' },
        { userId: 'u2', role: 'Member' },
        { userId: 'u3', role: 'Member' },
      ],
      tags: [
        { id: 'g1', name: 'design', color: 'bg-violet-100 text-violet-800' },
        { id: 'g2', name: 'copy', color: 'bg-amber-100 text-amber-800' },
        { id: 'g3', name: 'bug', color: 'bg-red-100 text-red-800' },
      ],
    },
    {
      id: 'b2',
      name: 'Hiring Q4',
      archived: false,
      members: [
        { userId: 'u2', role: 'Owner' },
        { userId: 'u1', role: 'Member' },
      ],
      tags: [{ id: 'g4', name: 'urgent', color: 'bg-red-100 text-red-800' }],
    },
    {
      id: 'b3',
      name: 'Old offsite planning',
      archived: true,
      members: [{ userId: 'u1', role: 'Owner' }],
      tags: [],
    },
  ],
  lists: [
    { id: 'l1', boardId: 'b1', name: 'Backlog', archived: false, position: 1 },
    { id: 'l2', boardId: 'b1', name: 'Doing', archived: false, position: 2 },
    { id: 'l3', boardId: 'b1', name: 'Done', archived: false, position: 3 },
    { id: 'l4', boardId: 'b1', name: 'Parked ideas', archived: true, position: 4 },
    { id: 'l5', boardId: 'b2', name: 'Open roles', archived: false, position: 1 },
    { id: 'l6', boardId: 'b2', name: 'Interviewing', archived: false, position: 2 },
    { id: 'l7', boardId: 'b3', name: 'Venues', archived: false, position: 1 },
  ],
  tasks: [
    t('t1', 'b1', 'l1', 'Audit current page speed', 1, ['g3'], ['u3']),
    t('t2', 'b1', 'l1', 'Write new About copy', 2, ['g2'], ['u2']),
    t('t3', 'b1', 'l1', 'Pick a type scale', 3, ['g1'], []),
    t('t4', 'b1', 'l2', 'Homepage hero mockups', 1, ['g1'], ['u1', 'u2']),
    t('t5', 'b1', 'l2', 'Fix broken footer links', 2, ['g3'], ['u3']),
    t('t6', 'b1', 'l3', 'Kickoff meeting', 1, [], ['u1']),
    { ...t('t7', 'b1', 'l3', 'Old moodboard', 2, ['g1'], []), archived: true },
    t('t8', 'b1', 'l4', 'Animated mascot', 1, [], []),
    t('t9', 'b2', 'l5', 'Senior designer JD', 1, ['g4'], ['u2']),
    t('t10', 'b2', 'l6', 'Panel for backend role', 1, [], ['u1']),
    t('t11', 'b3', 'l7', 'Call the lake lodge', 1, [], []),
  ],
  entries: [
    e('b1', 't4', 'u1', 'created the task in Backlog', 0, 'change'),
    e('b1', 't4', 'u1', 'moved the task from Backlog to Doing', 60, 'change'),
    e('b1', 't4', 'u2', 'Could we try a darker variant too?', 120, 'comment'),
    e('b1', 't4', 'u1', 'moved the task to position 1 in Doing', 180, 'reorder'),
    e('b1', 't4', 'u1', 'added tag design', 240, 'change'),
    e('b1', 't4', 'u1', 'assigned Grace Hopper', 300, 'change'),
    e('b1', 't4', 'u1', 'Sure — two options by Friday.', 360, 'comment'),
    e(undefined, undefined, 'u1', 'signed in', 400, 'session'),
  ],
}

function t(
  id: string,
  boardId: string,
  listId: string,
  title: string,
  position: number,
  tagIds: string[],
  assigneeIds: string[],
): Task {
  return { id, boardId, listId, title, description: '', archived: false, position, tagIds, assigneeIds }
}
function e(
  boardId: string | undefined,
  taskId: string | undefined,
  actorId: string,
  text: string,
  mins: number,
  kind: Entry['kind'],
): Entry {
  return { id: `e${++seq}`, boardId, taskId, actorId, text, at: T0 + mins * 60_000, kind }
}

// ---------- selectors ----------
export const roleOf = (s: State, boardId: string, userId: string | null) =>
  s.boards.find((b) => b.id === boardId)?.members.find((m) => m.userId === userId)?.role ?? null
export const userName = (s: State, userId: string) => s.users.find((u) => u.id === userId)?.name ?? '?'
export const listsOf = (s: State, boardId: string, showArchived: boolean) =>
  s.lists
    .filter((l) => l.boardId === boardId && (showArchived || !l.archived))
    .sort((a, b) => a.position - b.position)
export const tasksOf = (s: State, listId: string, showArchived: boolean) =>
  s.tasks
    .filter((x) => x.listId === listId && (showArchived || !x.archived))
    .sort((a, b) => a.position - b.position)
export const activeTaskCount = (s: State, listId: string) =>
  s.tasks.filter((x) => x.listId === listId && !x.archived).length
export const activityOf = (s: State, taskId: string, showReorders: boolean) =>
  s.entries
    .filter((x) => x.taskId === taskId && (showReorders || x.kind !== 'reorder'))
    .sort((a, b) => a.at - b.at)

// ---------- commands (stubbed, in-memory) ----------
type Draft = State
const now = () => Date.now()

export function makeCommands(set: (fn: (d: Draft) => void) => void) {
  const log = (d: Draft, x: Omit<Entry, 'id' | 'at' | 'actorId'>) =>
    d.entries.push({ ...x, id: id('e'), at: now(), actorId: d.actorId! })

  const reorder = <X extends { position: number }>(items: X[], item: X, toIndex: number) => {
    const rest = items.filter((i) => i !== item)
    rest.splice(Math.max(0, Math.min(toIndex, rest.length)), 0, item)
    rest.forEach((i, n) => (i.position = n + 1))
  }

  return {
    signIn: (userId: string) =>
      set((d) => {
        d.actorId = userId
        log(d, { text: 'signed in', kind: 'session' })
      }),
    signOut: () =>
      set((d) => {
        log(d, { text: 'signed out', kind: 'session' })
        d.actorId = null
      }),
    signUp: (name: string, email: string) =>
      set((d) => {
        const u = { id: id('u'), name, email }
        d.users.push(u)
        d.actorId = u.id
        log(d, { text: 'signed up', kind: 'session' })
      }),
    createBoard: (name: string) =>
      set((d) => {
        const b: Board = { id: id('b'), name, archived: false, members: [{ userId: d.actorId!, role: 'Owner' }], tags: [] }
        d.boards.push(b)
        log(d, { boardId: b.id, text: `created board ${name}`, kind: 'change' })
      }),
    renameBoard: (boardId: string, name: string) =>
      set((d) => {
        const b = d.boards.find((x) => x.id === boardId)!
        log(d, { boardId, text: `renamed board from ${b.name} to ${name}`, kind: 'change' })
        b.name = name
      }),
    setBoardArchived: (boardId: string, archived: boolean) =>
      set((d) => {
        d.boards.find((x) => x.id === boardId)!.archived = archived
        log(d, { boardId, text: archived ? 'archived the board' : 'restored the board', kind: 'change' })
      }),
    addMember: (boardId: string, userId: string) =>
      set((d) => {
        d.boards.find((x) => x.id === boardId)!.members.push({ userId, role: 'Member' })
        log(d, { boardId, text: `added ${userName(d, userId)} as Member`, kind: 'change' })
      }),
    removeMember: (boardId: string, userId: string) =>
      set((d) => {
        const b = d.boards.find((x) => x.id === boardId)!
        const owner = b.members.find((m) => m.role === 'Owner')!.userId
        b.members = b.members.filter((m) => m.userId !== userId)
        log(d, { boardId, text: `removed ${userName(d, userId)}`, kind: 'change' })
        d.tasks
          .filter((x) => x.boardId === boardId && x.assigneeIds.includes(userId))
          .forEach((x) => {
            x.assigneeIds = [...new Set(x.assigneeIds.filter((a) => a !== userId).concat(owner))]
            log(d, {
              boardId,
              taskId: x.id,
              text: `assignment passed from ${userName(d, userId)} to ${userName(d, owner)} (because ${userName(d, userId)} was removed)`,
              kind: 'consequence',
            })
          })
      }),
    transferOwnership: (boardId: string, userId: string) =>
      set((d) => {
        const b = d.boards.find((x) => x.id === boardId)!
        b.members.forEach((m) => (m.role = m.userId === userId ? 'Owner' : m.role === 'Owner' ? 'Member' : m.role))
        log(d, { boardId, text: `transferred ownership to ${userName(d, userId)}`, kind: 'change' })
      }),
    leaveBoard: (boardId: string) =>
      set((d) => {
        const b = d.boards.find((x) => x.id === boardId)!
        b.members = b.members.filter((m) => m.userId !== d.actorId)
        log(d, { boardId, text: 'left the board', kind: 'change' })
      }),
    createTag: (boardId: string, name: string) =>
      set((d) => {
        d.boards
          .find((x) => x.id === boardId)!
          .tags.push({ id: id('g'), name, color: 'bg-sky-100 text-sky-800' })
        log(d, { boardId, text: `created tag ${name}`, kind: 'change' })
      }),
    createList: (boardId: string, name: string) =>
      set((d) => {
        const pos = Math.max(0, ...d.lists.filter((l) => l.boardId === boardId).map((l) => l.position)) + 1
        d.lists.push({ id: id('l'), boardId, name, archived: false, position: pos })
        log(d, { boardId, text: `created list ${name}`, kind: 'change' })
      }),
    renameList: (listId: string, name: string) =>
      set((d) => {
        const l = d.lists.find((x) => x.id === listId)!
        log(d, { boardId: l.boardId, text: `renamed list ${l.name} to ${name}`, kind: 'change' })
        l.name = name
      }),
    setListArchived: (listId: string, archived: boolean) =>
      set((d) => {
        const l = d.lists.find((x) => x.id === listId)!
        l.archived = archived
        log(d, { boardId: l.boardId, text: `${archived ? 'archived' : 'restored'} list ${l.name}`, kind: 'change' })
      }),
    moveList: (listId: string, toIndex: number) =>
      set((d) => {
        const l = d.lists.find((x) => x.id === listId)!
        reorder(listsOf(d, l.boardId, true), l, toIndex)
        log(d, { boardId: l.boardId, text: `moved list ${l.name} to position ${toIndex + 1}`, kind: 'reorder' })
      }),
    createTask: (listId: string, title: string) =>
      set((d) => {
        const l = d.lists.find((x) => x.id === listId)!
        const pos = Math.max(0, ...d.tasks.filter((x) => x.listId === listId).map((x) => x.position)) + 1
        const task = { ...t(id('t'), l.boardId, listId, title, pos, [], []) }
        d.tasks.push(task)
        log(d, { boardId: l.boardId, taskId: task.id, text: `created the task in ${l.name}`, kind: 'change' })
      }),
    updateTask: (taskId: string, patch: Partial<Pick<Task, 'title' | 'description'>>) =>
      set((d) => {
        const x = d.tasks.find((y) => y.id === taskId)!
        if (patch.title !== undefined && patch.title !== x.title)
          log(d, { boardId: x.boardId, taskId, text: `renamed the task from “${x.title}” to “${patch.title}”`, kind: 'change' })
        if (patch.description !== undefined && patch.description !== x.description)
          log(d, { boardId: x.boardId, taskId, text: 'edited the description', kind: 'change' })
        Object.assign(x, patch)
      }),
    setTaskArchived: (taskId: string, archived: boolean) =>
      set((d) => {
        const x = d.tasks.find((y) => y.id === taskId)!
        x.archived = archived
        log(d, { boardId: x.boardId, taskId, text: archived ? 'archived the task' : 'restored the task', kind: 'change' })
      }),
    moveTask: (taskId: string, listId: string, toIndex: number) =>
      set((d) => {
        const x = d.tasks.find((y) => y.id === taskId)!
        const from = d.lists.find((l) => l.id === x.listId)!
        const to = d.lists.find((l) => l.id === listId)!
        x.listId = listId
        reorder(tasksOf(d, listId, true), x, toIndex)
        if (from.id !== to.id)
          log(d, { boardId: x.boardId, taskId, text: `moved the task from ${from.name} to ${to.name}`, kind: 'change' })
        else log(d, { boardId: x.boardId, taskId, text: `moved the task to position ${toIndex + 1} in ${to.name}`, kind: 'reorder' })
      }),
    toggleTag: (taskId: string, tagId: string) =>
      set((d) => {
        const x = d.tasks.find((y) => y.id === taskId)!
        const tag = d.boards.find((b) => b.id === x.boardId)!.tags.find((g) => g.id === tagId)!
        const has = x.tagIds.includes(tagId)
        x.tagIds = has ? x.tagIds.filter((g) => g !== tagId) : [...x.tagIds, tagId]
        log(d, { boardId: x.boardId, taskId, text: `${has ? 'removed' : 'added'} tag ${tag.name}`, kind: 'change' })
      }),
    toggleAssignee: (taskId: string, userId: string) =>
      set((d) => {
        const x = d.tasks.find((y) => y.id === taskId)!
        const has = x.assigneeIds.includes(userId)
        x.assigneeIds = has ? x.assigneeIds.filter((a) => a !== userId) : [...x.assigneeIds, userId]
        log(d, { boardId: x.boardId, taskId, text: `${has ? 'unassigned' : 'assigned'} ${userName(d, userId)}`, kind: 'change' })
      }),
    addComment: (taskId: string, text: string) =>
      set((d) => {
        const x = d.tasks.find((y) => y.id === taskId)!
        log(d, { boardId: x.boardId, taskId, text, kind: 'comment' })
      }),
  }
}

export type Commands = ReturnType<typeof makeCommands>
const Ctx = createContext<{ s: State; c: Commands } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(seed)
  const [c] = useState(() =>
    makeCommands((fn) =>
      setS((prev) => {
        const d = structuredClone(prev)
        fn(d)
        return d
      }),
    ),
  )
  return <Ctx.Provider value={{ s, c }}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('no store')
  return v
}
