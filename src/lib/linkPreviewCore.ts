// Link previews, the pure half: finding links in text and what a URL already
// says about itself. Ported from the web's linkPreview.ts. Nothing is invented:
// no title is guessed from a path, and a link with no answer is drawn as its
// host and the last readable segment of its own path.

export type PreviewFrom = 'derived' | 'read' | 'bare';

export interface LinkPreview {
  url: string;
  host: string;
  tail: string;
  title?: string;
  desc?: string;
  thumb?: string;
  icon?: string;
  kind?: string;
  from: PreviewFrom;
}

// Trailing punctuation is almost always the sentence's, not the URL's.
const TRAIL = /[.,;:!?)\]}'"»]+$/;

export function findLinks(text: string, cap = 6): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/https?:\/\/[^\s<>"'`]+/gi)) {
    let raw = m[0].replace(TRAIL, '');
    if (raw.endsWith(')') && !raw.includes('(')) raw = raw.slice(0, -1);
    if (!raw || seen.has(raw)) continue;
    try { new URL(raw); } catch { continue; }
    seen.add(raw);
    out.push(raw);
    if (out.length >= cap) break;
  }
  return out;
}

const YT_ID = /^[\w-]{11}$/;

function youTubeId(u: URL): string | null {
  const h = u.hostname.replace(/^www\.|^m\./, '');
  if (h === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return YT_ID.test(id) ? id : null;
  }
  if (h !== 'youtube.com' && h !== 'youtube-nocookie.com') return null;
  const v = u.searchParams.get('v');
  if (v && YT_ID.test(v)) return v;
  const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
  return m ? m[1] : null;
}

function driveId(u: URL): string | null {
  if (!/(^|\.)(drive|docs)\.google\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/\/d\/([\w-]{10,})/);
  return m ? m[1] : (u.searchParams.get('id') || null);
}

function tailOf(u: URL): string {
  const segs = u.pathname.split('/').filter(Boolean);
  const last = segs[segs.length - 1] ?? '';
  let decoded = last;
  try { decoded = decodeURIComponent(last); } catch { /* keep the raw segment */ }
  const pretty = decoded.replace(/\.(html?|php|aspx?|pdf)$/i, '').replace(/[-_+]+/g, ' ').trim();
  return pretty.length > 2 && pretty.length < 80 ? pretty : (segs.join(' / ') || u.hostname);
}

/** What the URL says on its own. A thumbnail here is a claim the image itself settles. */
export function derive(url: string): LinkPreview | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const host = u.hostname.replace(/^www\./, '');
  const base: LinkPreview = { url, host, tail: tailOf(u), from: 'bare' };

  const yt = youTubeId(u);
  if (yt) return { ...base, kind: 'video', from: 'derived', tail: 'YouTube', thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` };

  const gd = driveId(u);
  if (gd) return { ...base, kind: 'file', from: 'derived', tail: 'Google Drive', thumb: `https://drive.google.com/thumbnail?id=${gd}&sz=w480` };

  return base;
}
