// Ported verbatim from the web app's supabase/functions/_shared/dayCandidates.ts at BPA@c6b42ed.
// The web shares this one file between the app and its bots so they make and read exactly the same mark;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── What a day might be worth marking ───────────────────────────────────────
// Pure: facts about one day in, a short ranked list of things *true about it* out.
// Nothing here reads a store, a clock or the network, so the calendar and (later)
// the bots offer exactly the same candidates. The engine **proposes**; keeping one
// is the person's act, and nothing is ever written from here.
//
// Every candidate carries a `source` — what kind of fact and which one — so a day
// never offers, or keeps, the same fact twice, and a kept one can say where it came
// from. Only facts that can be checked are offered:
//   • a P0 / P1 task finished that day            (a quieter one is not an achievement)
//   • five or more tasks finished that day         ("cleared N" — the sum, not each)
//   • a habit finished that day whose run of consecutive days is a milestone
//   • every habit finished that day (at least two)
//   • a book finished that day

export interface CandidateFacts {
  /** YYYY-MM-DD */
  date: string
  tasks: { id: string; title: string; completedAt?: string | null; priority?: string | null }[]
  /** `doneOn` is every day the habit was FINISHED (a tick, or a goal met) — a part-day is not in it. */
  habits: { id: string; name: string; frequency?: string; doneOn: string[]; active?: boolean }[]
  books: { id: string; title: string; finishedOn?: string | null }[]
}

export interface Candidate {
  emoji: string
  text: string
  source: { kind: string; id: string }
  /** One line saying why this was offered, for the card. */
  why: string
}

export const STREAK_MILESTONES = [7, 14, 21, 30, 50, 60, 90, 100, 150, 200, 365] as const
const CLEARED_AT = 5

/** Is a run of this many days one worth marking? The listed ones, then every 100 after 365's neighbour. */
export function isMilestone(n: number): boolean {
  return (STREAK_MILESTONES as readonly number[]).includes(n) || (n > 365 && n % 100 === 0)
}

/** Previous calendar day, as a date string — calendar arithmetic, never `- 86 400 000`. */
export function dayBefore(ds: string): string {
  const [y, m, d] = ds.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - 1))
  return dt.toISOString().slice(0, 10)
}

/** The run of consecutive finished days that ENDS on `date` (0 when `date` itself is not finished). */
export function runEndingOn(doneOn: string[], date: string): number {
  const have = new Set(doneOn)
  let n = 0
  for (let d = date; have.has(d); d = dayBefore(d)) n++
  return n
}

export const sourceKey = (s: { kind: string; id: string }) => `${s.kind}:${s.id}`

/** Candidates for `facts.date`, best first. `skip` holds the `kind:id` of facts already kept or set aside. */
export function dayCandidates(facts: CandidateFacts, skip: ReadonlySet<string> = new Set(), limit = 6): Candidate[] {
  const out: { c: Candidate; rank: number }[] = []
  const add = (rank: number, c: Candidate) => { if (!skip.has(sourceKey(c.source))) out.push({ c, rank }) }
  const day = facts.date

  const doneToday = facts.tasks.filter(t => t.completedAt === day)
  for (const t of doneToday) {
    const title = (t.title ?? '').trim() || 'A task'
    if (t.priority === 'P0') add(1, { emoji: '🏆', text: `Finished: ${title}`, source: { kind: 'task', id: t.id }, why: 'A P0 task, done today' })
    else if (t.priority === 'P1') add(4, { emoji: '✅', text: `Finished: ${title}`, source: { kind: 'task', id: t.id }, why: 'A P1 task, done today' })
  }
  if (doneToday.length >= CLEARED_AT) {
    add(6, { emoji: '💪', text: `Cleared ${doneToday.length} tasks`, source: { kind: 'tasks-day', id: day }, why: `${doneToday.length} tasks finished today` })
  }

  for (const b of facts.books) {
    if (b.finishedOn === day) add(2, { emoji: '📚', text: `Finished ${(b.title ?? '').trim() || 'a book'}`, source: { kind: 'book', id: b.id }, why: 'A book finished today' })
  }

  const live = facts.habits.filter(h => h.active !== false)
  for (const h of live) {
    // A streak is consecutive *days*; a weekdays or weekly habit has gaps by design, so no run is claimed for it.
    if ((h.frequency ?? 'daily') !== 'daily') continue
    const n = runEndingOn(h.doneOn, day)
    if (isMilestone(n)) add(3, { emoji: '🔥', text: `${h.name}: ${n} days in a row`, source: { kind: 'habit-streak', id: `${h.id}:${n}` }, why: `${n} consecutive days, ending today` })
  }
  if (live.length >= 2 && live.every(h => h.doneOn.includes(day))) {
    add(5, { emoji: '🌟', text: 'Every habit done', source: { kind: 'habits-day', id: day }, why: `All ${live.length} habits finished today` })
  }

  return out.sort((a, b) => a.rank - b.rank).map(x => x.c).slice(0, limit)
}
