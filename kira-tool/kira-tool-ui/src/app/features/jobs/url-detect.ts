export type ProviderName = 'DRIVE' | 'SCRIBD';

export interface Detection {
  provider: ProviderName | null;
  valid: boolean;
  hint: string;
}

const MAX_LENGTH = 2048;
const DRIVE_PATH = /^\/file\/d\/[A-Za-z0-9_-]{10,100}(\/.*)?$/;
const SCRIBD_PATH = /^\/(document|doc|embeds)\/\d{3,15}(\/.*)?$/;
const SCRIBD_HOST = /^(www\.|[a-z]{2}\.)?scribd\.com$/;

/**
 * Client-side mirror of the server allowlist, for instant feedback only.
 * The server (ProviderUrlParser) stays authoritative.
 */
export function detectProvider(raw: string): Detection {
  const input = raw.trim();
  if (!input) return {provider: null, valid: false, hint: ''};
  if (input.length > MAX_LENGTH) return bad('That link is too long.');

  // WHATWG URL hides default ports (':443') and percent-encodes chars java.net.URI rejects; mirror the server here.
  if (/^https:\/\/[^/?#]*:\d/i.test(input)) return bad('Links with credentials or ports are not supported.');
  if (/[\s"<>\\^`{|}]/.test(input)) return bad('This link looks unusual and was rejected.');

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return bad('Enter a full link starting with https://');
  }
  if (url.protocol !== 'https:') return bad('Only https links are supported.');
  if (url.username || url.password || url.port) return bad('Links with credentials or ports are not supported.');
  // No '%' check, same as the server: ID regexes exclude '%', and non-ASCII slugs arrive percent-encoded.
  if (url.pathname.includes('..')) return bad('This link looks unusual and was rejected.');

  const host = url.hostname.toLowerCase();
  if (host === 'drive.google.com') {
    return DRIVE_PATH.test(url.pathname)
      ? {provider: 'DRIVE', valid: true, hint: 'Google Drive file detected.'}
      : bad('Use a Google Drive file link like drive.google.com/file/d/.../view');
  }
  if (SCRIBD_HOST.test(host)) {
    return SCRIBD_PATH.test(url.pathname)
      ? {provider: 'SCRIBD', valid: true, hint: 'Scribd document detected.'}
      : bad('Use a Scribd document link like scribd.com/document/123456/...');
  }
  return bad('Only Google Drive and Scribd links are supported.');
}

function bad(hint: string): Detection {
  return {provider: null, valid: false, hint};
}
