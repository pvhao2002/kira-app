/** Lower-case and strip Vietnamese diacritics so "thue" matches "Thuế". */
export function normalizeVi(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/** True when every word of the query occurs in the text, ignoring case and diacritics. */
export function matchesSearch(text: string, query: string): boolean {
  const haystack = normalizeVi(text);
  return normalizeVi(query).split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
}
