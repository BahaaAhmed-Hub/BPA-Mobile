// Link previews, the half that touches the network: the `link-preview` edge
// function reads a page's og: tags for links a URL cannot answer for itself.
// A failure is never cached — the derived answer stands and the next open asks
// again, so a function that is not deployed costs nothing but the server read.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { derive, type LinkPreview } from './linkPreviewCore';

export * from './linkPreviewCore';

const KEY = 'professor-link-previews';
const TTL = 14 * 24 * 60 * 60 * 1000;
const CAP = 300;

type Cached = { at: number; p: LinkPreview };
let bag: Record<string, Cached> = {};
let loaded: Promise<void> | null = null;

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY).then(v => { if (v) bag = { ...JSON.parse(v), ...bag }; }).catch(() => {});
  return loaded;
}

function persist() {
  const keys = Object.keys(bag);
  if (keys.length > CAP) {
    keys.sort((a, b) => (bag[a]?.at ?? 0) - (bag[b]?.at ?? 0));
    for (const k of keys.slice(0, keys.length - CAP)) delete bag[k];
  }
  void AsyncStorage.setItem(KEY, JSON.stringify(bag)).catch(() => {});
}

/** What is known right now, with no request of any kind. */
export function cachedPreview(url: string): LinkPreview | null {
  const hit = bag[url];
  if (hit && Date.now() - hit.at < TTL) return hit.p;
  return derive(url);
}

let asking: Promise<void> | null = null;

export async function readPreviews(urls: string[]): Promise<Record<string, LinkPreview>> {
  await load();
  const now = Date.now();
  const want = urls.filter(u => {
    const hit = bag[u];
    if (hit && now - hit.at < TTL && hit.p.from === 'read') return false;
    return derive(u)?.from !== 'derived';
  });
  if (!want.length) return {};

  while (asking) await asking;
  let release: () => void = () => {};
  asking = new Promise<void>(r => { release = r; });
  try {
    const { data, error } = await supabase.functions.invoke('link-preview', { body: { urls: want.slice(0, 8) } });
    if (error || !data || !Array.isArray((data as { previews?: unknown }).previews)) return {};
    const out: Record<string, LinkPreview> = {};
    for (const row of (data as { previews: Partial<LinkPreview>[] }).previews) {
      if (!row?.url) continue;
      const d = derive(row.url);
      if (!d) continue;
      // The server fills in; it never overwrites what the URL already proved.
      const merged: LinkPreview = {
        ...d,
        title: row.title || undefined,
        desc: row.desc || undefined,
        thumb: d.thumb || row.thumb || undefined,
        icon: row.icon || undefined,
        from: (row.title || row.thumb || row.icon) ? 'read' : d.from,
      };
      out[row.url] = merged;
      bag[row.url] = { at: now, p: merged };
    }
    persist();
    return out;
  } catch {
    return {};
  } finally {
    release();
    asking = null;
  }
}
