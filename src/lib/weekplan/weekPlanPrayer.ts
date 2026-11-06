// Ported verbatim from the web app's supabase/functions/_shared/weekPlanPrayer.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── Prayer times, as time the week planner keeps free ───────────────────────
//
// If prayer times are switched on (Settings → Habits), the five prayers are not time to put work in. Each is a
// short block of busy time at the minute the sun puts it, worked out for the person's place by `prayer.ts` — the
// one file the habit already uses, so the planner and the Habits page cannot disagree about when Dhuhr is.
//
// The minutes `prayerTimes` gives are wall-clock minutes in the PLACE's zone; they become instants there. That is
// not necessarily the zone the week is planned in (a person travelling plans Cairo hours from London), so the
// planning zone never moves a prayer.
//
// Pure — the app reads `professor-prayer` from its store, the bots from the shared prefs bag, both hand it here.

import { fromZone, ymd } from '../time/slots'
import { addDays } from '../time/taskTime'
import { METHODS, PRAYERS, prayerTimes } from './prayer'
import type { AsrSchool, PrayerMethod } from './prayer'
import type { Busy } from './weekPlan'

/** How long a prayer is kept free. Not the prayer itself — the washing, the walk, the quiet after. */
export const PRAYER_BLOCK_MINS = 25

export interface PrayerPrefs {
  enabled: boolean
  method: PrayerMethod
  school: AsrSchool
  place: { lat: number; lon: number; tz?: string } | null
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** The `professor-prayer` pref (JSON text, or already parsed) as the planner reads it. Anything unreadable is "off". */
export function parsePrayerPrefs(raw: unknown): PrayerPrefs {
  let v: unknown = raw
  if (typeof raw === 'string') { try { v = JSON.parse(raw) } catch { v = null } }
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const p = (o.place && typeof o.place === 'object' ? o.place : null) as Record<string, unknown> | null
  return {
    enabled: o.enabled === true,
    method: typeof o.method === 'string' && o.method in METHODS ? o.method as PrayerMethod : 'egyptian',
    school: o.school === 'hanafi' ? 'hanafi' : 'standard',
    place: p && num(p.lat) && num(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180
      ? { lat: p.lat, lon: p.lon, tz: typeof p.tz === 'string' && p.tz ? p.tz : undefined } : null,
  }
}

export interface PrayerBusy { busy: Busy[]; note?: string }

/** Busy time for the seven days from `weekOf` (and a day either side, so a zone difference loses nothing). */
export function prayerBusy(weekOf: string, planTz: string, prefs: PrayerPrefs): PrayerBusy {
  if (!prefs.enabled) return { busy: [] }
  if (!prefs.place) return { busy: [], note: 'Prayer times are on but no place is set, so they were not kept free (Settings → Habits).' }
  const tz = prefs.place.tz || planTz
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }) } catch { return { busy: [], note: `The prayer place's time zone "${tz}" is not one, so prayer times were not kept free.` } }
  // `prayerTimes` reads the RUNTIME's zone for a place that has none, so the same place would give different
  // minutes in a browser and on a server. Always say which zone the place is in.
  const place = { ...prefs.place, tz }
  const busy: Busy[] = []
  for (let i = -1; i <= 7; i++) {
    const date = addDays(weekOf, i)
    const times = prayerTimes(date, place, prefs.method, prefs.school)
    const [y, m, d] = ymd(date)
    for (const id of PRAYERS) {
      const min = times[id]
      if (min == null || !Number.isFinite(min)) continue            // the sun never reaches the angle
      const start = fromZone(y, m, d, 0, Math.round(min), 0, tz)
      busy.push({ start, end: start + PRAYER_BLOCK_MINS * 60_000, load: 'light' })
    }
  }
  return { busy }
}
