/** WCAG contrast ratio of white text on the given #rrggbb background. */
export function whiteContrast(hex: string): number {
  const c = hex.replace('#', '').match(/../g)!.map(v => {
    const x = parseInt(v, 16) / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (L + 0.05);
}

export const AA_RATIO = 4.5;
