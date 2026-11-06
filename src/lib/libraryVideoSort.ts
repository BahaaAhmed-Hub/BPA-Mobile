// ─── Ordering a book's videos ────────────────────────────────────────────────
// Pure — no imports — so the order can be asserted without a browser.
//
// Three orders: most watched (the default), most liked, and "best match" — the
// order YouTube answered in. **Videos that name this book always come before the
// looser ones**, whatever the order chosen: a nearby video with ninety million
// views must not sit above the book's own, which is the whole point of the filter.
// A count that is `null` (not fetched, or a channel hiding its likes) sorts **last**,
// never as zero — "unknown" is not "least". Ties fall back to the other count, then
// to YouTube's own order, so the result is the same every time it is drawn.

export type SortKey = 'watched' | 'liked' | 'match'

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'watched', label: 'Most watched' },
  { value: 'liked', label: 'Most liked' },
  { value: 'match', label: 'Best match' },
]

export interface Sortable { strict: boolean; views: number | null; likes: number | null }

/** Larger first; `null` after every number. */
const desc = (a: number | null, b: number | null): number =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : b - a

export function sortVideos<T extends Sortable>(items: readonly T[], by: SortKey): T[] {
  const indexed = items.map((v, i) => ({ v, i }))
  indexed.sort((x, y) => {
    if (x.v.strict !== y.v.strict) return x.v.strict ? -1 : 1
    if (by === 'match') return x.i - y.i
    const first = by === 'watched' ? desc(x.v.views, y.v.views) : desc(x.v.likes, y.v.likes)
    if (first !== 0) return first
    const second = by === 'watched' ? desc(x.v.likes, y.v.likes) : desc(x.v.views, y.v.views)
    return second !== 0 ? second : x.i - y.i
  })
  return indexed.map(x => x.v)
}

/** "1.2M", "45K", "980" — what fits on a card. */
export function compact(n: number): string {
  // By hand: compact notation in Intl is not there on every Hermes build.
  const f = (v: number, unit: string) => `${(Math.round(v * 10) / 10).toString().replace(/\.0$/, '')}${unit}`
  if (n >= 1e9) return f(n / 1e9, 'B')
  if (n >= 1e6) return f(n / 1e6, 'M')
  if (n >= 1e3) return f(n / 1e3, 'K')
  return String(n)
}

/** The line under a title: what is known, and nothing that is not. `''` when neither count is. */
export function statsLine(v: { views: number | null; likes: number | null }): string {
  const parts: string[] = []
  if (v.views !== null) parts.push(`${compact(v.views)} views`)
  if (v.likes !== null) parts.push(`${compact(v.likes)} likes`)
  return parts.join(' · ')
}
