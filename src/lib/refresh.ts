import { backoffLeft } from './serverStrain';
import { useTaskStore } from '../store/taskStore';
import { taskWritesInFlight } from '../store/taskStore';
import { useHabitStore, habitWritesInFlight } from '../store/habitStore';
import { useCompanyStore } from '../store/companyStore';
import { useFinanceStore } from '../store/financeStore';

// Each screen loads its data once, when it opens, so an edit made on the web
// never arrived until the app was restarted. Coming back to the app refreshes
// it — but not on every return: each refresh is several reads, and switching
// away and back is something people do dozens of times an hour.
export const MIN_GAP_MS = 60_000;

let last = 0;
let running = false;

export type RefreshOutcome = 'refreshed' | 'too-soon' | 'busy' | 'server-struggling' | 'writing';

export async function refreshIfStale(opts: { force?: boolean; now?: number } = {}): Promise<RefreshOutcome> {
  const now = opts.now ?? Date.now();
  if (running) return 'busy';
  if (!opts.force && now - last < MIN_GAP_MS) return 'too-soon';
  // A server that is failing is left alone, one probe at a time once it recovers.
  if (backoffLeft(now) > 0) return 'server-struggling';
  // Something the person just did is still on its way to the server.
  if (taskWritesInFlight() > 0 || habitWritesInFlight() > 0) return 'writing';

  running = true;
  last = now;
  try {
    await Promise.all([
      useTaskStore.getState().loadFromDB(),
      useHabitStore.getState().loadFromDB(),
      useCompanyStore.getState().loadFromDB(),
      useFinanceStore.getState().loadAll(),
    ]);
    return 'refreshed';
  } finally {
    running = false;
  }
}
