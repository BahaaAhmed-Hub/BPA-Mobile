import { create } from 'zustand';
import { notify } from './feedbackStore';
import { useTaskStore } from './taskStore';
import { checkSession, endFor, runningOfTask, type TaskSession } from '../lib/time/taskSessions';
import { DISCARD_UNDER_MS } from '../lib/time/timer';
import { deleteSession, insertSession, isAlreadyRunning, loadRecentSessions, stopSession } from '../lib/time/sessionsDb';

/** Sittings being written right now: a refresh must not replace the list under them. */
let writesInFlight = 0;
export const sessionWritesInFlight = (): boolean => writesInFlight > 0;

interface SessionState {
  sessions: TaskSession[];
  loading: boolean;
  /** The web's task_sessions migration has not run on this project: time tracking is not offered. */
  unavailable: boolean;
  loadFromDB: () => Promise<void>;
  startTimer: (taskId: string) => Promise<boolean>;
  /** Stop a timer. Under 30 seconds it is discarded, as on the web: a slip of the finger is not a sitting. */
  stopTimer: (id: string) => Promise<{ kept: boolean; ms: number } | null>;
  /** Time typed in by hand: a sitting is a fact about the past, so one that ends in the future is refused. */
  addManual: (p: { taskId: string; start: number; end: number; note?: string }) => Promise<boolean>;
  removeSession: (id: string) => Promise<boolean>;
  clearAll: () => void;
}

const titleOf = (taskId: string) => useTaskStore.getState().tasks.find(t => t.id === taskId)?.title.trim() || 'a task';

export const useTaskSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  loading: false,
  unavailable: false,

  async loadFromDB() {
    if (writesInFlight > 0) return;
    set({ loading: true });
    const r = await loadRecentSessions();
    // A failed read is not an empty ledger: keep what is drawn.
    if (r === null) { set({ loading: false }); return; }
    if (r === 'missing') { set({ loading: false, unavailable: true, sessions: [] }); return; }
    set({ loading: false, unavailable: false, sessions: r });
  },

  async startTimer(taskId) {
    if (get().unavailable) return false;
    if (!useTaskStore.getState().tasks.some(t => t.id === taskId)) { notify('error', 'That task is gone.'); return false; }
    if (runningOfTask(get().sessions, taskId)) { notify('error', `“${titleOf(taskId)}” is being timed already.`); return false; }
    const draft = { taskId, start: Date.now(), end: null, source: 'timer' as const };
    const temp: TaskSession = { ...draft, id: `tmp-${draft.start}-${taskId}` };
    set({ sessions: [...get().sessions, temp] });
    writesInFlight++;
    const r = await insertSession(draft);
    writesInFlight--;
    if (!r.ok) {
      set({ sessions: get().sessions.filter(s => s.id !== temp.id) });
      if (isAlreadyRunning(r.code)) { notify('error', `“${titleOf(taskId)}” is being timed already, on another device.`); void get().loadFromDB(); }
      else notify('error', "Couldn't start that timer. Nothing was changed.");
      return false;
    }
    set({ sessions: get().sessions.map(s => s.id === temp.id ? r.session : s) });
    return true;
  },

  async stopTimer(id) {
    const cur = get().sessions.find(s => s.id === id);
    if (!cur || cur.end !== null) return null;
    const now = Date.now();
    const ran = Math.max(0, now - cur.start);

    if (ran < DISCARD_UNDER_MS) {
      const before = get().sessions;
      set({ sessions: before.filter(s => s.id !== id) });
      writesInFlight++;
      const r = await deleteSession(id);
      writesInFlight--;
      if (!r.ok) { set({ sessions: before }); notify('error', "Couldn't stop that timer. It is still running."); return null; }
      notify('info', `Discarded: “${titleOf(cur.taskId)}” ran under 30 seconds.`);
      return { kept: false, ms: ran };
    }

    const { end, review } = endFor(cur, now);
    const stopped: TaskSession = { ...cur, end, review };
    const before = get().sessions;
    set({ sessions: before.map(s => s.id === id ? stopped : s) });
    writesInFlight++;
    const r = await stopSession(stopped);
    writesInFlight--;
    if (!r.ok) { set({ sessions: before }); notify('error', "Couldn't stop that timer. It is still running."); return null; }
    // Someone stopped it first (another device): take their end rather than ours.
    if (!r.stopped) void get().loadFromDB();
    return { kept: true, ms: end - cur.start };
  },

  async addManual({ taskId, start, end, note }) {
    if (get().unavailable) return false;
    const draft = { taskId, start, end, source: 'manual' as const, ...(note?.trim() ? { note: note.trim() } : {}) };
    const bad = checkSession({ ...draft, id: 'x' }) ?? (end > Date.now() ? 'A sitting is in the past: it cannot end in the future.' : null);
    if (bad) { notify('error', bad); return false; }
    writesInFlight++;
    const r = await insertSession(draft);
    writesInFlight--;
    if (!r.ok) { notify('error', "Couldn't save that time. Nothing was changed."); return false; }
    set({ sessions: [...get().sessions, r.session].sort((a, b) => a.start - b.start) });
    return true;
  },

  async removeSession(id) {
    const before = get().sessions;
    set({ sessions: before.filter(s => s.id !== id) });
    writesInFlight++;
    const r = await deleteSession(id);
    writesInFlight--;
    if (!r.ok) { set({ sessions: before }); notify('error', "Couldn't delete that. It was kept."); return false; }
    return true;
  },

  clearAll() { set({ sessions: [], loading: false, unavailable: false }); },
}));
