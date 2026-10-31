/**
 * "Quick paste" for the AI agent: one block of front-matter + Markdown fills the whole article form,
 * so a computer-use agent pastes once instead of typing into eight fields.
 */
export interface QuickPaste {
  title?: string;
  slug?: string;
  summary?: string;
  category?: string;
  tags?: string[];
  cover?: string;
  sources?: string[];
  body: string;
}

const LIST_KEYS = new Set(['tags', 'sources']);

export function parseQuickPaste(text: string): QuickPaste {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(normalized);
  if (!match) {
    return { body: normalized };
  }
  const result: QuickPaste = { body: match[2].trim() };
  const fields = result as unknown as Record<string, string | string[]>;
  let listKey: string | null = null;
  for (const line of match[1].split('\n')) {
    const item = /^\s*-\s+(.+)$/.exec(line);
    if (item && listKey) {
      (fields[listKey] as string[]).push(item[1].trim());
      continue;
    }
    const pair = /^([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
    if (!pair) {
      continue;
    }
    const key = pair[1].toLowerCase();
    const value = pair[2].trim();
    if (LIST_KEYS.has(key)) {
      fields[key] = value.split(',').map((part) => part.trim()).filter(Boolean);
      listKey = key;
    } else {
      fields[key] = value;
      listKey = null;
    }
  }
  return result;
}
