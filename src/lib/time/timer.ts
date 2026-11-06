// The pure parts of the web's src/lib/taskTimer.ts at BPA@c54edac: the clock and the rules, with the store wiring left out.
import { HOUR, MINUTE } from './taskTime';
import type { TaskSession } from './taskSessions';

/** Shorter than this and a stopped timer is discarded. */
export const DISCARD_UNDER_MS = 30_000
/** A timer running longer than this is probably forgotten, and the list says so. */
export const FORGOTTEN_AFTER_MS = 12 * HOUR

export const runningTimers = (sessions: TaskSession[]): TaskSession[] =>
  sessions.filter(s => s.source === 'timer' && s.end === null).sort((a, b) => a.start - b.start)

export const elapsedMs = (s: Pick<TaskSession, 'start'>, now: number): number => Math.max(0, now - s.start)

/** `1:05:09`, or `5:09` under an hour. */
export function clock(ms: number): string {
  const t = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`
}

/** "25 min", "1 h 5 min". */
export function span(ms: number): string {
  const m = Math.max(1, Math.round(ms / MINUTE))
  return m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`
}

