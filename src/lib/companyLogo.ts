// A company's logo as the web stores it: pixels in a data URL on the `companies` row, never a link and never markup.
// Only an image data URL is ever drawn; anything else (a link someone typed, an SVG string) falls back to letters,
// because drawing a remote address would be a request to somebody else's server on every render.

const IMAGE_URL = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
/** The web caps a stored logo at a few KB; refuse anything absurd rather than hold it in memory. */
const MAX_CHARS = 400_000;

export function logoSource(url: string | null | undefined): string | null {
  if (!url || url.length > MAX_CHARS) return null;
  return IMAGE_URL.test(url) ? url : null;
}

/** Up to two letters for the mark when there is no logo: the first letters of the first two words. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters = words.length === 1 ? Array.from(words[0]).slice(0, 2) : [Array.from(words[0])[0], Array.from(words[1])[0]];
  return letters.join('').toUpperCase();
}
