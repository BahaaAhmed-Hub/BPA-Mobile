// What the screens say about time, derived from sessions every time: nothing here is stored, so removing a wrong
// sitting corrects every figure. Built on the web's rules in taskTime.ts, so "time worked" (the clock, overlaps once) and
// "task-hours" (every task added up) always come from the same intervals.
import { addDays, dayOf, rangeStats, statsByDay, type DayStats } from './taskTime';
import { isAssumed, timeInputs, type TaskSession } from './taskSessions';

export interface TodayNumbers { worked: number; taskHours: number; gain: number; running: number }

/** Today's two numbers, in the reader's own day. */
export function todayNumbers(sessions: TaskSession[], tz: string, now: number): TodayNumbers {
  const { running, floating } = timeInputs(sessions);
  const day = dayOf(now, tz);
  const s: DayStats | undefined = statsByDay(running, floating, tz, now)[day];
  return {
    worked: s?.worked ?? 0, taskHours: s?.taskHours ?? 0, gain: s?.gain ?? 0,
    running: sessions.filter(x => x.end === null).length,
  };
}

/** The last `n` days ending today, summed, for a week's headline. */
export function lastDays(sessions: TaskSession[], tz: string, now: number, n: number): DayStats {
  const { running, floating } = timeInputs(sessions);
  const to = dayOf(now, tz);
  return rangeStats(statsByDay(running, floating, tz, now), addDays(to, -(n - 1)), to);
}

/** What has been logged on one task, as the web's Time card says it: stopped sittings added up, how much of that is
 *  assumed (an estimate or a plan standing in for work nobody timed), and how many sittings. A timer still running is
 *  not in the total; it shows on its own clock until it is stopped. */
export function taskTime(sessions: TaskSession[], taskId: string): { totalMs: number; assumedMs: number; sittings: number } {
  const ended = sessions.filter(s => s.taskId === taskId && s.end !== null);
  const len = (s: TaskSession) => Math.max(0, (s.end as number) - s.start);
  return {
    totalMs: ended.reduce((n, s) => n + len(s), 0),
    assumedMs: ended.filter(isAssumed).reduce((n, s) => n + len(s), 0),
    sittings: ended.length,
  };
}

/** A task's sittings, newest first, for a list. Estimates are marked as such: they were never on the clock. */
export function sittingsOf(sessions: TaskSession[], taskId: string, limit = 8): TaskSession[] {
  return sessions.filter(s => s.taskId === taskId).sort((a, b) => b.start - a.start).slice(0, limit);
}
