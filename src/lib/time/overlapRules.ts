// Ported verbatim from the web app's supabase/functions/_shared/overlapRules.ts at BPA@c54edac.
// The web shares this one file between the app and its bots so they cannot judge time differently;
// the phone does the same. Change it on the web first, then re-copy — do not edit here.
// ─── Two things at once: allowed, or a double booking? ───────────────────────
//
// Until now every overlap was a clash, because the only thing the app knew
// about an event was when it was. But "an online call while an AI writes a
// summary in the background" is a Tuesday, and "a dentist appointment while you
// write a report" is a mistake — and the difference is not in the clock, it is
// in what each one asks of you. So each thing gets a LOAD, and a pair is judged
// by the two loads.
//
//   away     in person, somewhere else (an event with a physical location)
//   focus    deep work, study, research — your whole attention
//   present  a call or meeting you are on, but online (a conference link)
//   light    do / email / follow-up, or any task marked as running in the
//            background (an AI is doing it)
//
//   away and focus share with nothing. present shares with light. light shares
//   with light and present.
//
// Rules that are deliberately one-sided:
// - **A mistake in this file is cheaper in one direction.** A flagged pair the
//   person decides is fine costs a glance; a real double booking nobody flagged
//   costs the meeting. So every doubt resolves to `away` — exclusive — which is
//   what every overlap was before this existed.
// - **A plain event with no location and no link is `away`** for the same
//   reason: nothing says it can be shared.
// - **A location that is a link is a link.** People paste the Zoom address into
//   the Where box; that is an online meeting, not a room.
// - **The task's own type decides focus and light**, whatever the event says;
//   its location and link decide meeting and call, since "meeting" alone cannot
//   tell a room from a screen.
// - **An override beats all of it** — it is how "runs in the background" and
//   "this one is deep work, whatever its title says" are said.
//
// Pure, no Deno: the app re-exports it from `src/lib/overlapRules.ts`, the bots
// import it as it stands, and `scripts/overlap-rules.mjs` runs this file itself.

import { MINUTE, peakConcurrency, spansOverlap } from './taskTime'
import type { Span } from './taskTime'

export type Load = 'away' | 'focus' | 'present' | 'light'

export const LOADS: readonly Load[] = ['away', 'focus', 'present', 'light']

/** More than this many light things running at once is too many to be paying
 *  attention to, even if each one alone is fine. A warning, not a clash. */
export const LIGHT_CAP = 4

export const isLoad = (v: unknown): v is Load => typeof v === 'string' && (LOADS as readonly string[]).includes(v)

const FOCUS_TYPES = new Set(['deepwork', 'study', 'research'])
const LIGHT_TYPES = new Set(['do', 'email', 'followup'])

const urlLike = (s: string): boolean => /^(https?:\/\/|www\.)/i.test(s.trim())

export interface LoadInput {
  /** The task's type (`TaskType`), when the thing is a task. */
  taskType?: string | null
  /** A person's say-so for this one thing. Beats everything. */
  override?: Load | string | null
  /** The event's Where box. */
  location?: string | null
  /** A conference link on the event (Meet, Zoom…). */
  hasLink?: boolean
}

export function loadOf(i: LoadInput): Load {
  if (isLoad(i.override)) return i.override
  const type = (i.taskType ?? '').toLowerCase()
  if (FOCUS_TYPES.has(type)) return 'focus'
  if (LIGHT_TYPES.has(type)) return 'light'

  // Meeting, call, an unknown type, or no task at all: read the event.
  const where = (i.location ?? '').trim()
  const physical = where !== '' && !urlLike(where)
  const online = !!i.hasLink || (where !== '' && urlLike(where))
  if (physical) return 'away'        // a hybrid meeting is a meeting you travel to
  if (online) return 'present'
  return 'away'
}

const SHARES: Record<Load, readonly Load[]> = {
  away: [],
  focus: [],
  present: ['light'],
  light: ['light', 'present'],
}

/** May these two loads run at the same time? Symmetric by construction. */
export const canShare = (a: Load, b: Load): boolean => SHARES[a].includes(b) && SHARES[b].includes(a)

export interface Placed extends Span { id: string; load: Load }

export type Verdict = 'clear' | 'together' | 'clash'

export function pairVerdict(a: Placed, b: Placed): Verdict {
  if (!spansOverlap(a, b)) return 'clear'
  return canShare(a.load, b.load) ? 'together' : 'clash'
}

export interface Clash { a: string; b: string; start: number; end: number }
export interface Stack { ids: string[]; start: number; end: number; peakLight: number; crowded: boolean }
export interface Analysis { clashes: Clash[]; stacks: Stack[] }

/** Every double booking and every deliberate overlap among `items`. */
export function analyse(items: Placed[]): Analysis {
  const live = items.filter(p => p.end > p.start)
  const order = live.slice().sort((x, y) => x.start - y.start || x.end - y.end || (x.id < y.id ? -1 : 1))
  const clashes: Clash[] = []
  const parent = new Map<string, string>()
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r }
  const union = (x: string, y: string) => { const rx = find(x), ry = find(y); if (rx !== ry) parent.set(rx, ry) }
  for (const p of order) parent.set(p.id, p.id)

  const together = new Set<string>()
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length && order[j].start < order[i].end; j++) {
      const a = order[i], b = order[j]
      const v = pairVerdict(a, b)
      if (v === 'clash') clashes.push({ a: a.id, b: b.id, start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) })
      else if (v === 'together') { union(a.id, b.id); together.add(a.id); together.add(b.id) }
    }
  }

  const groups = new Map<string, Placed[]>()
  for (const p of order) if (together.has(p.id)) {
    const r = find(p.id)
    groups.set(r, [...(groups.get(r) ?? []), p])
  }
  const stacks: Stack[] = []
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const peakLight = peakConcurrency(members.filter(m => m.load === 'light'))
    stacks.push({
      ids: members.map(m => m.id),
      start: Math.min(...members.map(m => m.start)),
      end: Math.max(...members.map(m => m.end)),
      peakLight,
      crowded: peakLight > LIGHT_CAP,
    })
  }
  stacks.sort((x, y) => x.start - y.start)
  return { clashes, stacks }
}

/** What would happen if `candidate` were placed among `others`. */
export function checkPlacement(candidate: Placed, others: Placed[]): { clashes: Placed[]; together: Placed[] } {
  const clashes: Placed[] = []
  const together: Placed[] = []
  for (const o of others) {
    if (o.id === candidate.id) continue
    const v = pairVerdict(candidate, o)
    if (v === 'clash') clashes.push(o)
    else if (v === 'together') together.push(o)
  }
  return { clashes, together }
}

/** The earliest start at or after `from` — on a `step` grid — at which something of this load and length fits
 *  among `others` without clashing (sharing an hour that is allowed is fine; touching is fine), finishing by
 *  `until`. `null` when there is no such time. This is what "move it clear" offers: not a guess at what the
 *  person would like, only the first time the rules do not object. */
export function nextFit(
  candidate: { id: string; load: Load; ms: number },
  others: Placed[],
  from: number,
  until: number,
  step: number = 15 * MINUTE,
): number | null {
  if (!(candidate.ms > 0) || !(until > from)) return null
  const first = Math.ceil(from / step) * step
  for (let t = first, n = 0; t + candidate.ms <= until && n < 2000; t += step, n++) {
    if (checkPlacement({ id: candidate.id, load: candidate.load, start: t, end: t + candidate.ms }, others).clashes.length === 0) return t
  }
  return null
}
