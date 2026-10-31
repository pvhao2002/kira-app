import DOMPurify from 'dompurify';
import { useEffect, useMemo, useRef } from 'react';
import { renderMarkdown, type Heading } from '../markdown';

let mermaidReady: Promise<typeof import('mermaid').default> | null = null;
const loadMermaid = () =>
  (mermaidReady ??= import('mermaid').then(({ default: m }) => {
    m.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', fontFamily: 'Inter' });
    return m;
  }));

export function useMarkdown(md: string): { html: string; headings: Heading[] } {
  return useMemo(() => {
    const { html, headings } = renderMarkdown(md);
    return { html: DOMPurify.sanitize(html), headings };
  }, [md]);
}

/** Renders sanitized markdown; mermaid is only downloaded when the article has a diagram. */
export function Markdown({ html, className = 'prose-ks' }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const nodes = ref.current?.querySelectorAll<HTMLElement>('.mermaid');
    if (!nodes?.length) return;
    loadMermaid()
      .then((m) => m.run({ nodes: [...nodes] }))
      .catch(() => nodes.forEach((n) => n.classList.add('mermaid-error')));
  }, [html]);
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
