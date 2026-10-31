import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { parseLibrarySettings, type Book, type LibrarySettings, type Quote } from '../lib/library';

interface LibraryState {
  books: Book[];
  quotes: Quote[];
  settings: LibrarySettings;
  loading: boolean;
  loaded: boolean;
  /** The tables are not there, or this plan has no Library (row-level security answers with nothing or an error). */
  unavailable: boolean;
  loadFromDB: () => Promise<void>;
  clearAll: () => void;
}

const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /relation .* does not exist|schema cache/i.test(e.message ?? ''));

const BOOK_COLS = 'id, title, subtitle, authors, status, rating, pages, format, cover_url, spine_color, review, description, started_on';

export const useLibraryStore = create<LibraryState>(set => ({
  books: [],
  quotes: [],
  settings: { enabled: true, dailyQuote: true },
  loading: false,
  loaded: false,
  unavailable: false,

  async loadFromDB() {
    set({ loading: true });
    // Whether the person has the Library on is a preference that travels with them (a shared pref).
    const { data: { session } } = await supabase.auth.getSession();
    let settings: LibrarySettings = { enabled: true, dailyQuote: true };
    if (session) {
      const { data } = await supabase.from('users').select('s:schedule_rules->shared_prefs->>library-settings').eq('id', session.user.id).maybeSingle();
      settings = parseLibrarySettings((data as unknown as { s?: string | null } | null)?.s);
    }
    // Off means never loaded, not loaded and hidden.
    if (!settings.enabled) { set({ settings, books: [], quotes: [], loading: false, loaded: true }); return; }

    const [b, q] = await Promise.all([
      supabase.from('library_books').select(BOOK_COLS).order('shelf_order', { ascending: true }),
      supabase.from('library_quotes').select('id, book_id, kind, body, page, created_at').order('created_at', { ascending: true }).limit(2000),
    ]);
    if (missing(b.error) || missing(q.error)) { set({ settings, books: [], quotes: [], unavailable: true, loading: false, loaded: true }); return; }
    // An error is not an empty shelf: keep what was shown rather than blanking it.
    if (b.error || q.error) { set({ settings, loading: false }); return; }
    set({ settings, books: (b.data ?? []) as Book[], quotes: (q.data ?? []) as Quote[], unavailable: false, loading: false, loaded: true });
  },

  clearAll() { set({ books: [], quotes: [], loaded: false, unavailable: false, settings: { enabled: true, dailyQuote: true } }); },
}));
