/** Public site settings baked into the build. */
export const SITE = {
  name: 'Kira News 247',
  tagline: 'Tin tức 24/7',
  // Canonical origin used in <link rel=canonical>, Open Graph and JSON-LD.
  url: 'http://localhost:4300',
  // ipinfo.io token (browser-visible by design: ipinfo is called from the reader's browser). Empty = free tier.
  // shortcut: build-time constant; serve it from the SSR server if it must change without a rebuild.
  ipinfoToken: '',
  timeZone: 'Asia/Ho_Chi_Minh',
} as const;
