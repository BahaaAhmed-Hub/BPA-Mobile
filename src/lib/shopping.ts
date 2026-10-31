import type { DbShoppingGroup, DbShoppingItem } from '../types/database';

/** What is still to buy. `planned` is an item scheduled for a trip, which is still to buy. */
export const isToBuy = (i: Pick<DbShoppingItem, 'status'>): boolean => i.status !== 'purchased';

/** The fields that change when an item is ticked off — and that must be cleared again when it is un-ticked, or the
 *  history shows a purchase date for something that is back on the list. */
export function purchasePatch(bought: boolean, now: Date = new Date()): Pick<DbShoppingItem, 'status' | 'purchased_at' | 'final_price' | 'store_used_id'> {
  return bought
    ? { status: 'purchased', purchased_at: now.toISOString(), final_price: null, store_used_id: null }
    : { status: 'wanted', purchased_at: null, final_price: null, store_used_id: null };
}

export interface Section { group: DbShoppingGroup | null; toBuy: DbShoppingItem[]; bought: DbShoppingItem[] }

/** Items filed under their list, in the order set on the web; items with no list (or whose list is gone or
 *  archived) are under "No list", which is always there so an item can never be orphaned out of sight. */
export function sectionsOf(groups: DbShoppingGroup[], items: DbShoppingItem[]): Section[] {
  const live = groups.filter(g => g.status === 'active').sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const byOrder = (a: DbShoppingItem, b: DbShoppingItem) => (b.priority - a.priority) || (a.sort_order - b.sort_order) || a.created_at.localeCompare(b.created_at);
  const ids = new Set(live.map(g => g.id));
  const out: Section[] = live.map(g => {
    const mine = items.filter(i => i.group_id === g.id).sort(byOrder);
    return { group: g, toBuy: mine.filter(isToBuy), bought: mine.filter(i => !isToBuy(i)) };
  });
  const loose = items.filter(i => !i.group_id || !ids.has(i.group_id)).sort(byOrder);
  out.push({ group: null, toBuy: loose.filter(isToBuy), bought: loose.filter(i => !isToBuy(i)) });
  return out;
}

/** "2 kg", "3", or "" for one of something with no unit. */
export function quantityText(i: Pick<DbShoppingItem, 'quantity' | 'unit'>): string {
  const q = Number.isInteger(i.quantity) ? String(i.quantity) : String(Math.round(i.quantity * 100) / 100);
  if (i.unit) return `${q} ${i.unit}`;
  return i.quantity === 1 ? '' : q;
}
