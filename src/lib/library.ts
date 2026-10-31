// The Library, in the parts the phone shows. Ported from the web app's dailyQuote.ts and libraryPrefs.ts.

export type BookStatus = 'want' | 'reading' | 'finished' | 'paused' | 'abandoned';

export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  status: BookStatus;
  rating: number;
  pages: number | null;
  format: string;
  cover_url: string | null;
  spine_color: string | null;
  review: string | null;
  description: string | null;
  started_on: string | null;
  finished_on?: string | null;
}

export interface Quote {
  id: string;
  book_id: string;
  kind: 'text' | 'image';
  body: string | null;
  page: number | null;
  created_at: string;
}

export const STATUS_LABEL: Record<BookStatus, string> = {
  reading: 'Reading', want: 'Want to read', finished: 'Finished', paused: 'Paused', abandoned: 'Abandoned',
};

// ── Settings ────────────────────────────────────────────────────────────────

export interface LibrarySettings { enabled: boolean; dailyQuote: boolean }

/** Pure: the stored `library-settings` string in. Absent means ON — a person who has never opened Settings has not
 *  said no — and only an explicit `false` turns a thing off; junk reads as "not said no". */
export function parseLibrarySettings(raw: string | null | undefined): LibrarySettings {
  const on = { enabled: true, dailyQuote: true };
  if (!raw) return on;
  try {
    const p = JSON.parse(raw) as { enabled?: unknown; dailyQuote?: unknown };
    return { enabled: p.enabled !== false, dailyQuote: p.dailyQuote !== false };
  } catch { return on; }
}

// ── Which of your quotes is today's ─────────────────────────────────────────
// Deterministic, so every device shows the same one all day without storing anything: the quotes with words are put
// in a fixed order and the day number picks the place in it. Walking the order (rather than hashing the date) means
// every quote comes round once before any repeats.

/** Whole calendar days from `a` to `b` (YYYY-MM-DD), counted by civil date so a clock change cannot skip a day. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** A quote that can be shown as words: a photographed page with nothing typed has none. */
export const hasWords = (q: Pick<Quote, 'body'>): boolean => !!q.body && q.body.trim().length > 0;

/** The same order everywhere, whatever order the server returned them in. */
export function inOrder<T extends Pick<Quote, 'id' | 'created_at'>>(quotes: T[]): T[] {
  return [...quotes].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

/** `shift` is "Another": a session-only step past today's, which wraps both ways. */
export function quoteOfTheDay<T extends Pick<Quote, 'id' | 'created_at' | 'body'>>(quotes: T[], today: string, shift = 0): T | null {
  const pool = inOrder(quotes.filter(hasWords));
  if (!pool.length) return null;
  const day = daysBetween('1970-01-01', today);
  const i = (((day + shift) % pool.length) + pool.length) % pool.length;
  return pool[i];
}
