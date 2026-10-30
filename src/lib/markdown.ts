// Parsing for the assistant's Markdown. Pure, so it is tested without a phone.

export type Inline = { text: string; bold?: boolean; code?: boolean; href?: string };

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: src.slice(last, i) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith('`')) out.push({ text: tok.slice(1, -1), code: true });
    else {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      out.push(mm ? { text: mm[1], href: mm[2] } : { text: tok });
    }
    last = i + tok.length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
}

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'li'; text: string; marker: string }
  | { kind: 'img'; alt: string; url: string };

export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ kind: 'p', text: para.join(' ') }); para = []; } };
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    if (/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-')) continue; // a table's rule line
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim());
    if (img) { flush(); blocks.push({ kind: 'img', alt: img[1], url: img[2] }); continue; }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) { flush(); blocks.push({ kind: 'li', text: bullet[1], marker: '•' }); continue; }
    const num = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (num) { flush(); blocks.push({ kind: 'li', text: num[2], marker: `${num[1]}.` }); continue; }
    if (line.trim().startsWith('|')) { // a table row: cells on one line
      flush();
      blocks.push({ kind: 'p', text: line.split('|').map(c => c.trim()).filter(Boolean).join(' · ') });
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) { flush(); blocks.push({ kind: 'p', text: `**${heading[1]}**` }); continue; }
    para.push(line.trim());
  }
  flush();
  return blocks;
}
