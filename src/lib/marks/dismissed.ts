// "Not this" is remembered on this device only (the web's `cal-mark-dismissed`, deliberately not synced): it is a
// preference about suggestions, not a fact about the day. A kept mark that is later removed is offered again, and
// "Not this" is the way to stop that.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cal-mark-dismissed';
const key = (date: string, source: { kind: string; id: string }) => `${date}|${source.kind}:${source.id}`;

export async function loadDismissed(): Promise<Set<string>> {
  try { return new Set(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as string[]); } catch { return new Set(); }
}

export async function dismiss(date: string, source: { kind: string; id: string }): Promise<void> {
  const all = await loadDismissed();
  all.add(key(date, source));
  try { await AsyncStorage.setItem(KEY, JSON.stringify([...all].slice(-500))); } catch { /* storage full: the card simply offers it again */ }
}

/** The `kind:id` skip set for one day, for dayCandidates. */
export const skipFor = (all: Set<string>, date: string): Set<string> =>
  new Set([...all].filter(k => k.startsWith(`${date}|`)).map(k => k.slice(date.length + 1)));
