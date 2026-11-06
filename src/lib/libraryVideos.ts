// Videos about a book — the phone's side of the web app's `library-videos` edge function. The YouTube key and its
// daily quota are the project's, so the phone never holds them. Always has an answer for the person: when the function
// cannot help (no key, quota spent, YouTube down, not deployed) the screen still offers a plain YouTube search link.
import { supabase } from './supabase';

export type VideoTopic = 'review' | 'author';

export interface BookVideo {
  id: string; title: string; channel: string; publishedAt: string;
  /** The title names THIS book. False = probably about something nearby. */
  strict: boolean;
  /** `null` when unknown — never 0 for "unknown". */
  views: number | null; likes: number | null;
}

export type VideoStatus = 'not_configured' | 'quota' | 'unreachable' | 'unavailable';
export type MoreStatus = 'not_configured' | 'quota' | 'unreachable';
export type VideoResult =
  | { status: 'ok'; items: BookVideo[]; stale: boolean; canMore: boolean; moreStatus?: MoreStatus }
  | { status: VideoStatus; items: []; canMore: false };

export const VIDEO_NOTE: Record<VideoStatus, string> = {
  not_configured: 'Video search is not switched on for this app yet.',
  quota: 'Today’s video searches have all been used. They come back tomorrow.',
  unreachable: 'YouTube could not be reached just now.',
  unavailable: 'Video search is not available right now.',
};

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
/** The picture is derived from the id, never taken from a response. */
export const thumbUrl = (id: string): string => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

export function youtubeSearchUrl(b: { title: string; authors: string[] }, topic: VideoTopic): string {
  const main = (b.title.split(/\s*[:–—]\s+|\s+-\s+/)[0] || b.title).replace(/"/g, '').trim();
  const first = b.authors[0] ?? '';
  const q = topic === 'author' ? `${first ? first + ' ' : ''}"${main}" interview` : `"${main}" ${first} book summary review`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q.replace(/\s+/g, ' ').trim())}`;
}

const count = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null);

/** What a response is allowed to say about a video — anything else is dropped. */
export function readVideos(data: unknown): BookVideo[] {
  const items = (data as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((v: Partial<BookVideo>): BookVideo[] => {
    if (typeof v?.id !== 'string' || !VIDEO_ID.test(v.id) || typeof v.title !== 'string' || !v.title) return [];
    return [{
      id: v.id, title: v.title, channel: typeof v.channel === 'string' ? v.channel : '',
      publishedAt: typeof v.publishedAt === 'string' ? v.publishedAt : '',
      strict: v.strict === true, views: count(v.views), likes: count(v.likes),
    }];
  });
}

const memory = new Map<string, VideoResult>();
const inflight = new Map<string, Promise<VideoResult>>();
type AskBook = { id: string; title: string; authors: string[] };

/** `more` asks YouTube for the next page of the same search — the one thing that spends more quota. */
export function findVideos(b: AskBook, topic: VideoTopic, more = false): Promise<VideoResult> {
  const k = `${b.id}|${topic}`;
  if (!more) { const hit = memory.get(k); if (hit) return Promise.resolve(hit); }
  const flight = `${k}|${more ? 'more' : 'first'}`;
  const pending = inflight.get(flight);
  if (pending) return pending;
  const run = ask(b, topic, more).then(out => {
    if (out.status === 'ok' && out.items.length) memory.set(k, out);
    return out;
  }).finally(() => inflight.delete(flight));
  inflight.set(flight, run);
  return run;
}

async function ask(b: AskBook, topic: VideoTopic, more: boolean): Promise<VideoResult> {
  let data: unknown;
  try {
    const r = await supabase.functions.invoke('library-videos', { body: { title: b.title, authors: b.authors, topic, ...(more ? { more: true } : {}) } });
    if (r.error) return { status: 'unavailable', items: [], canMore: false };
    data = r.data;
  } catch { return { status: 'unavailable', items: [], canMore: false }; }

  const d = data as { status?: string; stale?: unknown; canMore?: unknown; moreStatus?: unknown };
  if (d?.status === 'ok') {
    const ms = d.moreStatus;
    return {
      status: 'ok', items: readVideos(data), stale: d.stale === true, canMore: d.canMore === true,
      ...(ms === 'quota' || ms === 'unreachable' || ms === 'not_configured' ? { moreStatus: ms } : {}),
    };
  }
  if (d?.status === 'not_configured' || d?.status === 'quota' || d?.status === 'unreachable') return { status: d.status, items: [], canMore: false };
  return { status: 'unavailable', items: [], canMore: false };
}

// ── what the person decided about a video, for one book (library_video_marks) ──────────────────────────────────

export type MarkKind = 'favorite' | 'hidden';
export interface VideoMark { videoId: string; mark: MarkKind; title: string; channel: string; publishedAt: string }
export type MarksLoad = { status: 'ok'; marks: VideoMark[] } | { status: 'missing' } | { status: 'error' };
export type MarkSave = 'ok' | 'missing' | 'error';

const isMissing = (code?: string) => code === '42P01' || code === 'PGRST205';

export async function loadMarks(bookId: string): Promise<MarksLoad> {
  const r = await supabase.from('library_video_marks').select('video_id, mark, title, channel, published_at').eq('book_id', bookId).order('created_at', { ascending: false });
  if (r.error) return isMissing(r.error.code) ? { status: 'missing' } : { status: 'error' };
  type Row = { video_id: string; mark: string; title: string | null; channel: string | null; published_at: string | null };
  const marks = ((r.data ?? []) as Row[]).flatMap((x): VideoMark[] =>
    VIDEO_ID.test(x.video_id) && (x.mark === 'favorite' || x.mark === 'hidden')
      ? [{ videoId: x.video_id, mark: x.mark, title: x.title ?? '', channel: x.channel ?? '', publishedAt: x.published_at ?? '' }] : []);
  return { status: 'ok', marks };
}

export async function saveMark(bookId: string, m: VideoMark): Promise<MarkSave> {
  if (!VIDEO_ID.test(m.videoId)) return 'error';
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return 'error';
  const r = await supabase.from('library_video_marks').upsert({
    book_id: bookId, video_id: m.videoId, user_id: uid, mark: m.mark,
    title: m.title.slice(0, 200), channel: m.channel.slice(0, 100), published_at: m.publishedAt.slice(0, 40),
    created_at: new Date().toISOString(),
  }, { onConflict: 'book_id,video_id' });
  return !r.error ? 'ok' : isMissing(r.error.code) ? 'missing' : 'error';
}

export async function clearMark(bookId: string, videoId: string): Promise<MarkSave> {
  const r = await supabase.from('library_video_marks').delete().eq('book_id', bookId).eq('video_id', videoId);
  return !r.error ? 'ok' : isMissing(r.error.code) ? 'missing' : 'error';
}
