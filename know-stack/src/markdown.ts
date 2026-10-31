import { Marked, type Tokens } from 'marked';

export type Heading = { id: string; text: string; depth: number };

const CALLOUTS: Record<string, { cls: string; icon: string; title: string }> = {
  NOTE: { cls: 'note', icon: 'info', title: 'Note' },
  TIP: { cls: 'tip', icon: 'tips_and_updates', title: 'Interview tip' },
  CAUTION: { cls: 'caution', icon: 'warning', title: 'Caution' },
  WARNING: { cls: 'caution', icon: 'warning', title: 'Warning' },
  ANTIPATTERN: { cls: 'antipattern', icon: 'report_problem', title: 'Anti-pattern' },
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

/** Markdown → HTML (unsanitized: callers must pass it through DOMPurify) plus the h2/h3 outline for the TOC. */
export function renderMarkdown(md: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        if (depth !== 2 && depth !== 3) return `<h${depth}>${inner}</h${depth}>\n`;
        const text = plain(inner);
        const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
        const n = (used.get(base) ?? 0) + 1;
        used.set(base, n);
        const id = n === 1 ? base : `${base}-${n}`;
        headings.push({ id, text, depth });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        if (lang === 'mermaid') return `<div class="mermaid">${escapeHtml(text)}</div>\n`;
        return false; // default renderer
      },
      blockquote({ tokens }: Tokens.Blockquote) {
        const first = tokens[0];
        const m = first?.type === 'paragraph' ? /^\[!(\w+)\]\s*/.exec((first as Tokens.Paragraph).text) : null;
        const kind = m && CALLOUTS[m[1].toUpperCase()];
        if (!kind) return `<blockquote>\n${this.parser.parse(tokens)}</blockquote>\n`;
        const p = first as Tokens.Paragraph;
        const rest = p.text.slice(m![0].length);
        const body = (rest ? this.parser.parse(new Marked().lexer(rest)) : '') + this.parser.parse(tokens.slice(1));
        return `<blockquote class="callout callout-${kind.cls}"><div class="callout-title"><span class="material-symbols-outlined">${kind.icon}</span>${kind.title}</div>${body}</blockquote>\n`;
      },
    },
  });
  return { html: marked.parse(md, { async: false }), headings };
}
