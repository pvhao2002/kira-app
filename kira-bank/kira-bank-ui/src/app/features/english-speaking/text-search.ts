/** Lower-case and strip Vietnamese accents, so searches match with or without diacritics. */
export function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/** Text as it should be read aloud: drop placeholder brackets and say "vs" as "versus". */
export function speakable(text: string): string {
  return text.replace(/\[|\]/g, '').replace(/\bvs\.?(?=\s)/g, 'versus');
}
