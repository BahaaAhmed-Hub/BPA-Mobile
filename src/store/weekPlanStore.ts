// The week being planned, on the phone. Nothing is persisted: a plan is a suggestion about a week as it is right now. This part
// reads and plans only; what is written to the calendar is a separate, explicit step a person presses (see weekPlanWrite).
import { create } from 'zustand';
import { planWeekFor } from '../lib/weekplan/gather';
import { addProposalWith, removeWrittenWith, type Written } from '../lib/weekplan/write';
import { phoneWriteDeps } from '../lib/weekplan/phoneWrite';
import { useTaskStore } from './taskStore';
import { useCalendarStore } from './calendarStore';
import { notify } from './feedbackStore';
import { phoneDeps } from '../lib/weekplan/phoneDeps';
import type { Outcome, PlanWhich } from '../lib/weekplan/weekPlanData';
import type { Proposal } from '../lib/weekplan/weekPlan';

export type RowState = { proposal: Proposal; state: 'adding' | 'added' | 'removing' | 'failed'; written?: Written; error?: string };

interface WeekPlanState {
  which: PlanWhich;
  plan: Outcome | null;
  /** Why no plan could be made at all (signed out, tasks unreadable): the planner's own `problem` is on `plan`. */
  say: string | null;
  loading: boolean;
  /** What has been written (or is being) this sitting, by proposal id. Never persisted: a plan is a suggestion; what is on the calendar is on the calendar. */
  rows: Record<string, RowState>;
  busyAll: boolean;
  add: (id: string) => Promise<boolean>;
  undo: (id: string) => Promise<void>;
  addAll: () => Promise<void>;
  /** Proposals the person left out of this sitting's plan. */
  dropped: string[];
  /** Tasks the person asked to have planned although the planner would have left them out ("Plan anyway"). */
  forced: string[];
  setWhich: (w: PlanWhich) => void;
  load: () => Promise<void>;
  drop: (id: string) => void;
  planAnyway: (taskId: string) => void;
  clear: () => void;
}

let run = 0;

export const useWeekPlanStore = create<WeekPlanState>((set, get) => ({
  which: 'next', plan: null, say: null, loading: false, dropped: [], forced: [], rows: {}, busyAll: false,

  setWhich(w) { set({ which: w, forced: [], dropped: [] }); void get().load(); },

  async load() {
    const mine = ++run;
    set({ loading: true, say: null });
    try {
      const r = await planWeekFor(phoneDeps, get().which, { force: get().forced });
      if (mine !== run) return;   // a newer request has started: this answer is about a week no longer asked for
      if ('say' in r) set({ plan: null, say: r.say, dropped: [] });
      else set(st => ({ plan: r, say: null, dropped: [], rows: Object.fromEntries(Object.entries(st.rows).filter(([, x]) => x.state === 'added' || x.state === 'removing')) }));
    } catch (e) {
      if (mine === run) set({ plan: null, say: e instanceof Error ? e.message : 'Something went wrong while planning.' });
    } finally {
      if (mine === run) set({ loading: false });
    }
  },

  drop(id) { set(s => ({ dropped: [...s.dropped, id] })); },
  planAnyway(taskId) { set(s => ({ forced: s.forced.includes(taskId) ? s.forced : [...s.forced, taskId] })); void get().load(); },
  async add(id) {
    const s = get();
    const p = visibleProposals(s.plan, s.dropped, s.rows).find(q => q.id === id);
    const cur = s.rows[id]?.state;
    if (!p || cur === 'adding' || cur === 'added' || cur === 'removing') return false;   // a second press must not make a second event
    set(st => ({ rows: { ...st.rows, [id]: { proposal: p, state: 'adding' } } }));
    const r = await addProposalWith(phoneWriteDeps, p);
    set(st => ({ rows: { ...st.rows, [id]: r.ok ? { proposal: p, state: 'added', written: r.written } : { proposal: p, state: 'failed', error: r.error } } }));
    if (r.ok) void afterWrite(p.date);
    else notify('error', r.error);
    return r.ok;
  },

  async undo(id) {
    const cur = get().rows[id];
    if (!cur?.written || cur.state !== 'added') return;
    set(st => ({ rows: { ...st.rows, [id]: { ...cur, state: 'removing' } } }));
    const r = await removeWrittenWith(phoneWriteDeps, cur.written);
    set(st => {
      const rows = { ...st.rows };
      if (r.ok) delete rows[id]; else rows[id] = { ...cur, state: 'added', error: r.error };
      return { rows };
    });
    if (r.ok) void afterWrite(cur.proposal.date); else notify('error', r.error);
  },

  async addAll() {
    if (get().busyAll) return;
    set({ busyAll: true });
    try {
      for (const p of visibleProposals(get().plan, get().dropped, get().rows)) {
        const st = get().rows[p.id]?.state;
        if (st === 'added' || st === 'adding' || st === 'removing') continue;
        await get().add(p.id);   // one at a time: a task's second block needs the first recorded
      }
    } finally { set({ busyAll: false }); }
  },

  clear() { run++; set({ plan: null, say: null, loading: false, dropped: [], forced: [], rows: {}, busyAll: false }); },
}));

/** What was written or is being written is on the calendar whatever the next plan says, so it stays shown (with its Undo). */

/** Everything to draw: the engine's proposals (left-out ones gone, written ones shown as they were written) in time order. */
export function visibleProposals(plan: Outcome | null, dropped: string[], rows: Record<string, RowState> = {}): Proposal[] {
  const seen = new Set(Object.keys(rows));
  const fresh = (plan?.result.proposals ?? []).filter(p => !seen.has(p.id) && !dropped.includes(p.id));
  return [...fresh, ...Object.values(rows).map(r => r.proposal)].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/** The calendar and the task list read again, so a block just written (or taken back) shows where it should. */
async function afterWrite(day: string): Promise<void> {
  try { await Promise.all([useTaskStore.getState().loadFromDB(), useCalendarStore.getState().syncFromGoogle(day, day)]); } catch { /* the next refresh will show it */ }
}
