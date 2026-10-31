// What this account may see. `my_modules()` resolves the plan and any override on the server and returns the whole
// answer; this is the phone's reading of it. A module is OFF only when the server resolved it to false — one the
// registry does not know is never off, or Settings would be the first casualty. It decides what is drawn, never
// what is permitted: the boundary is row-level security on the server.

export type Modules = Record<string, boolean>;

/** Pure: the rows `my_modules()` returns in, the map out. An empty answer means the migration has not run here — a
 *  question nobody answered, not a person with no modules — so it is `null`. */
export function parseModules(rows: unknown): Modules | null {
  if (!Array.isArray(rows)) return null;
  const out: Modules = {};
  for (const r of rows as { module_id?: string; enabled?: boolean }[]) {
    if (r && typeof r.module_id === 'string') out[r.module_id] = !!r.enabled;
  }
  return Object.keys(out).length ? out : null;
}

export const moduleIsOff = (modules: Modules | null, id: string): boolean => !!modules && modules[id] === false;
