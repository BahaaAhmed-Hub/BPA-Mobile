// Ported verbatim from the web app's supabase/functions/_shared/weekPlanBusy.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── What on a calendar is time that is not free ─────────────────────────────
//
// The same five rules the calendar's own double-booking check applies (`placedOf` in src/lib/eventLoad.ts), written
// once more here because a Deno function cannot import the app's bundle. A test runs BOTH over a battery of events and
// demands identical answers, so the planner and the grid cannot disagree about whether a declined meeting is busy.
//
//   all-day events         not a block of time (a holiday does not stop a Tuesday)
//   cancelled              not happening — in Google, or marked so in the app
//   marked Free            transparent: it says it does not take your time
//   declined by you        you are not going
//   everything else        busy, with the load the task behind it (if any) and the event's own place and link decide

import { loadOf } from '../time/overlapRules'
import { inferTaskType } from './taskTypes'
import type { Busy } from './weekPlan'

export interface PlanEvent {
  id: string
  status?: string
  summary?: string
  transparency?: string
  location?: string
  hangoutLink?: string
  conferenceData?: { entryPoints?: { entryPointType?: string }[] }
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: { self?: boolean; responseStatus?: string }[]
}

/** The task an event was made for, as far as its load goes. */
export interface EventTask { taskType?: string | null; title: string; load?: string | null }

const hasVideo = (ev: PlanEvent) => !!ev.hangoutLink || !!ev.conferenceData?.entryPoints?.some(e => e.entryPointType === 'video')

export function busyOf(ev: PlanEvent, task: EventTask | null | undefined, statusOf: (id: string) => string | undefined): Busy | null {
  if (!ev.start?.dateTime || !ev.end?.dateTime) return null
  const start = Date.parse(ev.start.dateTime), end = Date.parse(ev.end.dateTime)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  if (ev.status === 'cancelled' || statusOf(ev.id) === 'cancelled') return null
  if (ev.transparency === 'transparent') return null
  if (ev.attendees?.some(a => a.self && a.responseStatus === 'declined')) return null
  const load = loadOf({
    taskType: task ? (task.taskType ?? inferTaskType(task.title)) : undefined,
    override: task?.load,
    location: ev.location,
    hasLink: hasVideo(ev),
  })
  return { start, end, load, ...(ev.summary ? { title: ev.summary } : {}) }
}
