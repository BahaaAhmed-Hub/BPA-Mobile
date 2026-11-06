// The week being planned, on the phone. Nothing is persisted: a plan is a suggestion about a week as it is right now. This part
// reads and plans only; what is written to the calendar is a separate, explicit step a person presses (see weekPlanWrite).
import { create } from 'zustand';
import { planWeekFor } from '../lib/weekplan/gather';
import { phoneDeps } from '../lib/weekplan/phoneDeps';
import type { Outcome, PlanWhich } from '../lib/weekplan/weekPlanData';
import type { Proposal } from '../lib/weekplan/weekPlan';

interface WeekPlanState {
  which: PlanWhich;
  plan: Outcome | null;
  /** Why no plan could be made at all (signed out, tasks unreadable): the planner's own `problem` is on `plan`. */
  say: string | null;
  loading: boolean;
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
  which: 'next', plan: null, say: null, loading: false, dropped: [], forced: [],

  setWhich(w) { set({ which: w, forced: [], dropped: [] }); void get().load(); },

  async load() {
    const mine = ++run;
    set({ loading: true, say: null });
    try {
      const r = await planWeekFor(phoneDeps, get().which, { force: get().forced });
      if (mine !== run) return;   // a newer request has started: this answer is about a week no longer asked for
      if ('say' in r) set({ plan: null, say: r.say, dropped: [] });
      else set({ plan: r, say: null, dropped: [] });
    } catch (e) {
      if (mine === run) set({ plan: null, say: e instanceof Error ? e.message : 'Something went wrong while planning.' });
    } finally {
      if (mine === run) set({ loading: false });
    }
  },

  drop(id) { set(s => ({ dropped: [...s.dropped, id] })); },
  planAnyway(taskId) { set(s => ({ forced: s.forced.includes(taskId) ? s.forced : [...s.forced, taskId] })); void get().load(); },
  clear() { run++; set({ plan: null, say: null, loading: false, dropped: [], forced: [] }); },
}));

/** The blocks to draw: the engine's, minus those left out. */
export function visibleProposals(plan: Outcome | null, dropped: string[]): Proposal[] {
  return (plan?.result.proposals ?? []).filter(p => !dropped.includes(p.id));
}
