import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { notify } from './feedbackStore';
import { keyOf, rowToThread, visibleThreads, windowStart, type SmartRow, type SmartThread } from '../lib/mailSmart';

interface MailState {
  /** Every thread in the window that the analysis holds and the smart view would show. */
  threads: SmartThread[];
  loading: boolean;
  loaded: boolean;
  /** The tables are not there (the web's smart-mail migration has not been run on this database). */
  unavailable: boolean;
  loadFromDB: () => Promise<void>;
  setHandled: (t: SmartThread, handled: boolean) => Promise<void>;
  mute: (t: SmartThread) => Promise<void>;
  clearAll: () => void;
}

const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /relation .* does not exist|schema cache/i.test(e.message ?? ''));

// Threads with a write in flight: a reload that lands meanwhile must not put the old row back over the mark.
const inFlight = new Set<string>();
export const mailWritesInFlight = () => inFlight.size;

export const useMailStore = create<MailState>((set, get) => ({
  threads: [],
  loading: false,
  loaded: false,
  unavailable: false,

  async loadFromDB() {
    set({ loading: true });
    const from = windowStart();
    const { data, error } = await supabase
      .from('mail_smart_threads')
      .select('account_email, thread_id, last_message_id, last_at, subject, from_name, from_email, section, reply_state, need, draft, direct, addressed_to, bottleneck, awaiting_customer, handled_at, kind, muted, archived_at, acknowledged_at')
      .gte('last_at', new Date(from).toISOString())
      .order('last_at', { ascending: false })
      .limit(500);
    if (missing(error)) { set({ threads: [], unavailable: true, loading: false, loaded: true }); return; }
    // An error is not an empty inbox: keep what was shown rather than blanking it.
    if (error) { set({ loading: false }); return; }
    const local = new Map(get().threads.map(t => [keyOf(t), t]));
    const next = visibleThreads(((data ?? []) as SmartRow[]).map(rowToThread), from)
      .map(t => (inFlight.has(keyOf(t)) ? local.get(keyOf(t)) ?? t : t));
    set({ threads: next, unavailable: false, loading: false, loaded: true });
  },

  /** Mark a thread dealt with (or take that back). Stored on the analysis row, which the web and the assistant read:
   *  it leaves "To answer" until a new message arrives. It does not touch the mail itself. */
  async setHandled(t, handled) {
    const key = keyOf(t);
    const before = get().threads;
    set({ threads: before.map(x => (keyOf(x) === key ? { ...x, handled } : x)) });
    inFlight.add(key);
    const { error } = await supabase
      .from('mail_smart_threads')
      .update({ handled_at: handled ? new Date().toISOString() : null })
      .eq('account_email', t.accountEmail)
      .eq('thread_id', t.threadId);
    inFlight.delete(key);
    if (!error) return;
    set({ threads: get().threads.map(x => (keyOf(x) === key ? t : x)) });
    notify('error', "Couldn't save that, so it was undone.");
  },

  /** Ignore a thread for good: new messages on it do not bring it back. */
  async mute(t) {
    const key = keyOf(t);
    set({ threads: get().threads.filter(x => keyOf(x) !== key) });
    inFlight.add(key);
    const { error } = await supabase.from('mail_smart_threads').update({ muted: true }).eq('account_email', t.accountEmail).eq('thread_id', t.threadId);
    inFlight.delete(key);
    if (!error) return;
    set({ threads: [t, ...get().threads] });
    notify('error', "Couldn't ignore that thread, so it's back.");
  },

  clearAll() { set({ threads: [], loaded: false, unavailable: false }); },
}));
