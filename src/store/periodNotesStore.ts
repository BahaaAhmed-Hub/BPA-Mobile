import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { notify } from './feedbackStore';
import { useAuthStore } from './authStore';
import { updateSharedPref } from '../lib/sharedPrefs';
import { joinPeriodNotes, type NoteResult, type NoteTag, type PeriodNote } from '../lib/marks/dayNotes';
import { opAddNote, opRemoveNote, opRestoreNote, opUpdateNote, parseNotes, type NoteMap, type NoteOp } from '../lib/marks/periodNotesOps';

export const NOTES_KEY = 'cal-period-notes';

let writesInFlight = 0;
export const noteWritesInFlight = (): boolean => writesInFlight > 0;

interface NotesState {
  notes: NoteMap;
  loaded: boolean;
  loadFromDB: () => Promise<void>;
  addNote: (input: { start: string; end: string; text: string; tag?: NoteTag }) => Promise<NoteResult>;
  updateNote: (id: string, patch: { start?: string; end?: string; text?: string; tag?: NoteTag | null }) => Promise<NoteResult>;
  removeNote: (id: string) => Promise<PeriodNote | null>;
  restoreNote: (note: PeriodNote) => Promise<boolean>;
  clearAll: () => void;
}

export const usePeriodNotesStore = create<NotesState>((set, get) => {
  /** Show the change at once, write only what it touched joined into what the server holds now (so a note made on the web in
   *  the meantime is kept), and take it back with a message if the write did not land. */
  async function commit<R>(op: NoteOp<R>, failed: string): Promise<boolean> {
    if (!Object.keys(op.touched).length) return true;
    const before = get().notes;
    set({ notes: op.map });
    writesInFlight++;
    const r = await updateSharedPref(NOTES_KEY, cur => JSON.stringify(joinPeriodNotes(op.touched, parseNotes(cur))));
    writesInFlight--;
    if (!r.ok) { set({ notes: before }); notify('error', failed); return false; }
    set({ notes: parseNotes(r.value) });
    return true;
  }

  return {
    notes: {},
    loaded: false,

    async loadFromDB() {
      if (writesInFlight > 0) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.from('users').select('v:schedule_rules->shared_prefs->>cal-period-notes').eq('id', session.user.id).maybeSingle();
      // A failed read is not an empty diary. No row at all is also a failed read (an expired token returns none, not an error):
      // keep what is drawn.
      if (error || !data) return;
      set({ notes: parseNotes((data as { v?: string | null } | null)?.v), loaded: true });
    },

    async addNote(input) {
      const op = opAddNote(get().notes, input);
      if (!op.result.ok) return op.result;
      return (await commit(op, "Couldn't save that note. Nothing was changed.")) ? op.result : { ok: false, why: "Couldn't save that note." };
    },
    async updateNote(id, patch) {
      const op = opUpdateNote(get().notes, id, patch);
      if (!op.result.ok) return op.result;
      return (await commit(op, "Couldn't save that change. Nothing was changed.")) ? op.result : { ok: false, why: "Couldn't save that change." };
    },
    async removeNote(id) {
      const op = opRemoveNote(get().notes, id);
      if (!op.result) return null;
      return (await commit(op, "Couldn't remove that note. It was kept.")) ? op.result : null;
    },
    async restoreNote(note) { return commit(opRestoreNote(get().notes, note), "Couldn't put that note back."); },

    clearAll() { set({ notes: {}, loaded: false }); },
  };
});

useAuthStore.subscribe(state => { if (!state.user) usePeriodNotesStore.getState().clearAll(); });
