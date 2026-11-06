// A calendar day as `YYYY-MM-DD` in the reader's OWN zone. Marks and notes belong to a day, and the day a column is drawn
// for is a local one. `Date.toISOString().slice(0, 10)` is the UTC date: for a local midnight in any zone ahead of UTC
// (Cairo, most of the world) that is the PREVIOUS day, so a mark made for Monday was drawn under Tuesday.
export const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
