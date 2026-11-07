// Writing a book summary with Claude, and keeping it (library_summaries). Ported from the web app's bookSummary.ts and
// summaryDb.ts: an outline first, then one request per section; every step is handed to `onUpdate` so the caller saves
// it, and a failure partway leaves what was already written.
//
// The key is the person's own, from Settings → AI on the web (it travels in `shared_prefs`). It is read when a summary is
// asked for, held in this function's memory for that run, and never stored or logged on the phone.
import { supabase } from './supabase';
import { DEFAULT_CLAUDE_MODEL } from './assistant/settings';
import {
  LENGTHS, LENGTH_ORDER, OUTLINE_SYSTEM, SECTION_SYSTEM, cleanSection, outlinePrompt, parseOutline, sectionPrompt, sectionTokens,
  trimToSentence, type OutlineItem, type SummaryBook, type SummaryDoc, type SummaryLength, type SummarySection,
} from './librarySummaryPlan';

/** Thrown for a failure the screen can say out loud. */
export class AiFailure extends Error {}

function failureFor(status: number | undefined, hint: string): AiFailure {
  return new AiFailure(
    status === 401 || status === 403 ? 'Your Anthropic key was refused. Check it under Settings → AI on the web.'
    : status === 429 ? `The AI service is rate-limited right now. Try again in a minute. ${hint}`.trim()
    : status === 400 ? `The AI service refused this request. ${hint}`.trim()
    : `The summary did not work just now — the AI service did not answer. ${hint}`.trim(),
  );
}
const KEPT = 'What was written so far is kept — you can continue it.';

async function loadKeyAndModel(): Promise<{ key: string; model: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AiFailure('Sign in to have a summary written.');
  const { data } = await supabase.from('users')
    .select('ai:schedule_rules->shared_prefs->>professor-ai-config').eq('id', user.id).maybeSingle();
  let key = ''; let model = DEFAULT_CLAUDE_MODEL;
  try {
    const raw = (data as unknown as { ai?: string | null } | null)?.ai;
    if (raw) {
      const c = JSON.parse(raw) as { anthropicKey?: string; claudeModel?: string };
      key = (c.anthropicKey ?? '').replace(/\s+/g, '');
      model = (c.claudeModel ?? '').trim() || DEFAULT_CLAUDE_MODEL;
    }
  } catch { /* unreadable is the same as none */ }
  if (!key) throw new AiFailure('Add an Anthropic key under Settings → AI on the web to have a summary written.');
  return { key, model };
}

async function ask(ai: { key: string; model: string }, system: string, user: string, maxTokens: number, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': ai.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: ai.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw failureFor(undefined, KEPT);
  }
  if (!res.ok) throw failureFor(res.status, KEPT);
  const msg = await res.json() as { content?: { type: string; text?: string }[]; stop_reason?: string };
  return { text: msg.content?.find(b => b.type === 'text')?.text ?? '', truncated: msg.stop_reason === 'max_tokens' };
}

export interface WriteOptions {
  book: SummaryBook;
  length: SummaryLength;
  /** A partly written summary of the same length to carry on from. */
  resume?: SummaryDoc | null;
  /** Called with the whole document after the outline and after every section — save it. */
  onUpdate: (doc: SummaryDoc) => void | Promise<void>;
  onStep?: (index: number, total: number) => void;
  signal?: AbortSignal;
}

/** Stopping (the signal) returns a partial document; a failure throws an `AiFailure`. */
export async function writeSummary(o: WriteOptions): Promise<SummaryDoc> {
  const ai = await loadKeyAndModel();
  const plan = LENGTHS[o.length];
  let doc: SummaryDoc = o.resume && o.resume.length === o.length && o.resume.outline.length
    ? o.resume
    : { bookId: o.book.id, length: o.length, premise: '', outline: [], sections: [], model: '', updatedAt: new Date().toISOString() };

  if (!doc.outline.length) {
    const { text } = await ask(ai, OUTLINE_SYSTEM, outlinePrompt(o.book, plan), 1200, o.signal);
    const outline = parseOutline(text, plan.sections);
    if (!outline) throw new AiFailure('The AI service answered, but not in a form that could be read. Try again.');
    if ('unknown' in outline) {
      throw new AiFailure('The AI does not know this book well enough to summarise it without inventing things, so it wrote nothing. Adding the publisher’s blurb under About gives it more to go on.');
    }
    doc = { ...doc, premise: outline.premise, outline: outline.sections, model: ai.model, updatedAt: new Date().toISOString() };
    await o.onUpdate(doc);
  }

  for (let i = doc.sections.length; i < doc.outline.length; i++) {
    if (o.signal?.aborted) break;
    o.onStep?.(i, doc.outline.length);
    let reply: { text: string; truncated: boolean };
    try { reply = await ask(ai, SECTION_SYSTEM, sectionPrompt(o.book, doc, i, plan), sectionTokens(plan), o.signal); }
    catch (e) { if (o.signal?.aborted) break; throw e; }
    const text = cleanSection(trimToSentence(reply.text, reply.truncated));
    // An empty section is not saved: it would read as written, and the loop would never ask again.
    if (!text) throw new AiFailure('The AI service answered a section with nothing in it. Try continuing.');
    doc = { ...doc, sections: [...doc.sections, { title: doc.outline[i].title, text }], updatedAt: new Date().toISOString() };
    await o.onUpdate(doc);
  }
  return doc;
}

// ── the saved summary (library_summaries) ───────────────────────────────────────────────────────────────────────

export type LoadResult = { status: 'ok'; doc: SummaryDoc | null } | { status: 'missing' } | { status: 'error' };
export type SaveResult = 'ok' | 'missing' | 'error';
const isMissing = (code?: string) => code === '42P01' || code === 'PGRST205';
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

interface Row { book_id: string; length: string; premise: string | null; outline: unknown; sections: unknown; model: string | null; updated_at: string }

function toDoc(r: Row): SummaryDoc | null {
  if (!LENGTH_ORDER.includes(r.length as SummaryLength)) return null;
  const outline: OutlineItem[] = Array.isArray(r.outline)
    ? r.outline.map((o: { title?: unknown; focus?: unknown }) => ({ title: text(o?.title), focus: text(o?.focus) })).filter(o => o.title) : [];
  const sections: SummarySection[] = Array.isArray(r.sections)
    ? r.sections.map((s: { title?: unknown; text?: unknown }) => ({ title: text(s?.title), text: text(s?.text) })).filter(s => s.text) : [];
  return { bookId: r.book_id, length: r.length as SummaryLength, premise: text(r.premise), outline, sections, model: text(r.model), updatedAt: r.updated_at };
}

export async function loadSummary(bookId: string): Promise<LoadResult> {
  const r = await supabase.from('library_summaries').select('*').eq('book_id', bookId).maybeSingle();
  if (r.error) return isMissing(r.error.code) ? { status: 'missing' } : { status: 'error' };
  if (!r.data) return { status: 'ok', doc: null };
  const doc = toDoc(r.data as Row);
  return doc ? { status: 'ok', doc } : { status: 'error' };
}

/** One row per book: a new outline replaces the old summary, a new section adds to this one. */
export async function saveSummary(d: SummaryDoc): Promise<SaveResult> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return 'error';
  const r = await supabase.from('library_summaries').upsert({
    book_id: d.bookId, user_id: uid, length: d.length, premise: d.premise,
    outline: d.outline, sections: d.sections, model: d.model || null, updated_at: d.updatedAt,
  }, { onConflict: 'book_id' });
  return !r.error ? 'ok' : isMissing(r.error.code) ? 'missing' : 'error';
}
