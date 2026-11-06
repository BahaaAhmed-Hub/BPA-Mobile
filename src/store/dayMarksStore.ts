import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { notify } from './feedbackStore';
import { useAuthStore } from './authStore';
import { updateSharedPref } from '../lib/sharedPrefs';
import { joinDayMarks, type DayMark, type MarkResult, type MarkSource } from '../lib/marks/dayNotes';
import { opAdd, opRemove, opRestore, opUpdate, parseMarks, type MarkMap, type Op } from '../lib/marks/dayMarksOps';

export const MARKS_KEY = 'cal-day-marks';

let writesInFlight = 0;
export const markWritesInFlight = (): boolean => writesInFlight > 0;

interface MarksState {
  marks: MarkMap;
  loaded: boolean;
  loadFromDB: () => Promise<void>;
  addMark: (input: { date: string; emoji?: string; text?: string; source?: MarkSource }) => Promise<MarkResult>;
  updateMark: (id: string, patch: { emoji?: string; text?: string; date?: string }) => Promise<MarkResult>;
  removeMark: (id: string) => Promise<DayMark | null>;
  restoreMark: (mark: DayMark) => Promise<boolean>;
  clearAll: () => void;
}

export const useDayMarksStore = create<MarksState>((set, get) => {
  /** Apply an operation: show it at once, write only what it touched, joined into what the server holds now (so a mark made
   *  on the web in the meantime is kept), and take it back with a message if the write did not land. */
  async function commit<R>(op: Op<R>, failed: string): Promise<boolean> {
    if (!Object.keys(op.touched).length) return true;
    const before = get().marks;
    set({ marks: op.map });
    writesInFlight++;
    const r = await updateSharedPref(MARKS_KEY, cur => JSON.stringify(joinDayMarks(op.touched, parseMarks(cur))));
    writesInFlight--;
    if (!r.ok) { set({ marks: before }); notify('error', failed); return false; }
    set({ marks: parseMarks(r.value) });
    return true;
  }

  return {
    marks: {},
    loaded: false,

    async loadFromDB() {
      if (writesInFlight > 0) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.from('users').select('v:schedule_rules->shared_prefs->>cal-day-marks').eq('id', session.user.id).maybeSingle();
      // A failed read is not an empty diary. No row at all is also a failed read (an expired token returns none, not an error):
      // keep what is drawn.
      if (error || !data) return;
      set({ marks: parseMarks((data as { v?: string | null } | null)?.v), loaded: true });
    },

    async addMark(input) {
      const op = opAdd(get().marks, input);
      if (!op.result.ok) return op.result;
      const ok = await commit(op, "Couldn't save that mark. Nothing was changed.");
      return ok ? op.result : { ok: false, why: "Couldn't save that mark." };
    },

    async updateMark(id, patch) {
      const op = opUpdate(get().marks, id, patch);
      if (!op.result.ok) return op.result;
      const ok = await commit(op, "Couldn't save that change. Nothing was changed.");
      return ok ? op.result : { ok: false, why: "Couldn't save that change." };
    },

    async removeMark(id) {
      const op = opRemove(get().marks, id);
      if (!op.result) return null;
      return (await commit(op, "Couldn't remove that mark. It was kept.")) ? op.result : null;
    },

    async restoreMark(mark) {
      return commit(opRestore(get().marks, mark), "Couldn't put that mark back.");
    },

    clearAll() { set({ marks: {}, loaded: false }); },
  };
});

// Signing out leaves nothing of the last person's diary on the device.
useAuthStore.subscribe(state => { if (!state.user) useDayMarksStore.getState().clearAll(); });
