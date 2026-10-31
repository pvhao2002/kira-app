import { describe, expect, it } from 'vitest';
import { parseQuickPaste } from './front-matter';

describe('parseQuickPaste', () => {
  it('reads front-matter fields and body', () => {
    const result = parseQuickPaste(
      [
        '---',
        'title: Giá vàng: tăng mạnh',
        'summary: Sapo ngắn',
        'category: kinh-doanh',
        'tags: vàng, SJC , ',
        'cover: https://img.example.com/a.jpg',
        'sources:',
        '  - https://a.example.com',
        '  - https://b.example.com',
        '---',
        '',
        '## Nội dung',
        'Đoạn 1',
      ].join('\n'),
    );
    expect(result.title).toBe('Giá vàng: tăng mạnh');
    expect(result.category).toBe('kinh-doanh');
    expect(result.tags).toEqual(['vàng', 'SJC']);
    expect(result.sources).toEqual(['https://a.example.com', 'https://b.example.com']);
    expect(result.body).toBe('## Nội dung\nĐoạn 1');
  });

  it('accepts inline source lists, CRLF and no front-matter', () => {
    expect(parseQuickPaste('---\r\nsources: https://a.vn, https://b.vn\r\n---\r\nThân bài').sources).toEqual([
      'https://a.vn',
      'https://b.vn',
    ]);
    expect(parseQuickPaste('Chỉ có thân bài')).toEqual({ body: 'Chỉ có thân bài' });
  });
});
