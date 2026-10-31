import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('turns GitHub-style callouts into styled blocks', () => {
    const { html } = renderMarkdown('> [!TIP]\n> Use **virtual** threads.');
    expect(html).toContain('class="callout callout-tip"');
    expect(html).toContain('<strong>virtual</strong>');
    expect(html).not.toContain('[!TIP]');
  });

  it('collects h2/h3 headings with stable ids', () => {
    const { html, headings } = renderMarkdown('## 01 The Dual-Write Problem\n\ntext\n\n### Sub part\n\n## 01 The Dual-Write Problem');
    expect(headings).toEqual([
      { id: '01-the-dual-write-problem', text: '01 The Dual-Write Problem', depth: 2 },
      { id: 'sub-part', text: 'Sub part', depth: 3 },
      { id: '01-the-dual-write-problem-2', text: '01 The Dual-Write Problem', depth: 2 },
    ]);
    expect(html).toContain('<h2 id="01-the-dual-write-problem">');
  });

  it('emits mermaid fences as escaped diagram containers', () => {
    const { html } = renderMarkdown('```mermaid\ngraph LR\n  A-->B<script>\n```');
    expect(html).toContain('<div class="mermaid">graph LR\n  A--&gt;B&lt;script&gt;</div>');
  });

  it('leaves plain blockquotes alone', () => {
    expect(renderMarkdown('> just a quote').html).toContain('<blockquote>');
  });
});
