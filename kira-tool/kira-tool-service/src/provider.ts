import {ToolError} from './errors.ts';

export type Provider = 'DRIVE' | 'SCRIBD';

/** canonicalUrl is rebuilt from sourceId; the raw user input is never navigated. */
export interface ParsedUrl {
  provider: Provider;
  sourceId: string;
  canonicalUrl: string;
}

const MAX_LENGTH = 2048;
const DRIVE_PATH = /^\/file\/d\/([A-Za-z0-9_-]{10,100})(?:\/.*)?$/s;
const SCRIBD_PATH = /^\/(?:document|doc|embeds)\/([0-9]{3,15})(?:\/.*)?$/s;
const SCRIBD_HOST = /^(?:www[.]|[a-z]{2}[.])?scribd[.]com$/;

// java.net.URI-compatible parsing (strict RFC 2396): WHATWG URL normalizes too much (drops tabs/newlines, decodes
// hosts, rewrites IPv4 forms), so the Java service's accept/reject decisions are reproduced by hand here.
const URI = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/s;
// Space, controls, unwise chars, brackets outside the host, and a '%' not followed by two hex digits.
// Built from a string so no raw line-separator characters ever end up in this source file.
const ILLEGAL = new RegExp(
  '[\\u0000-\\u0020"<>\\\\^`{|}[\\]\\u007f-\\u009f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]'
    + '|%(?![0-9a-fA-F]{2})', 'u');
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z](?:[a-z0-9-]*[a-z0-9])?\.?$/i;
const AUTHORITY = /^(?:([^@]*)@)?(\[[0-9a-fA-F:.]+\]|[^:@[\]]*)(?::(\d*))?$/;

interface Authority {
  userInfo: string | null;
  host: string | null; // null when not a server-based authority (java.net.URI#getHost() == null)
  port: number;
}

function parseAuthority(raw: string): Authority | null {
  if (ILLEGAL.test(raw.replace(/^(?:[^@]*@)?\[[0-9a-fA-F:.]+\]/, 'h'))) return null;
  const m = AUTHORITY.exec(raw);
  if (!m) return {userInfo: null, host: null, port: -1};
  const host = m[2];
  const ok = host.startsWith('[') || IPV4.test(host) || HOSTNAME.test(host);
  return {userInfo: m[1] ?? null, host: ok ? host : null, port: m[3] ? Number(m[3]) : -1};
}

export function isAllowedHost(host: string): boolean {
  return host === 'drive.google.com' || SCRIBD_HOST.test(host);
}

/** SSRF gate: https only, exact host allowlist, no userinfo/port, ID extracted by regex. */
export function parseProviderUrl(raw: unknown): ParsedUrl {
  if (typeof raw !== 'string') throw invalid();
  const input = raw.trim();
  if (input === '' || input.length > MAX_LENGTH) throw invalid();
  const m = URI.exec(input);
  if (!m || ILLEGAL.test(m[3]) || ILLEGAL.test(m[4] ?? '') || ILLEGAL.test(m[5] ?? '')) throw invalid();
  if (m[1].toLowerCase() !== 'https') throw invalid();
  const auth = parseAuthority(m[2]);
  if (!auth || auth.userInfo !== null || auth.port !== -1 || auth.host === null) throw invalid();
  const host = auth.host.toLowerCase();
  const rawPath = m[3];
  // No '%' check: ID regexes exclude '%' and the URL is rebuilt from the ID, so encoded slugs are harmless.
  if (rawPath.includes('..')) throw invalid();
  if (!isAllowedHost(host)) throw new ToolError('UNSUPPORTED_PROVIDER');

  const drive = host === 'drive.google.com';
  const id = (drive ? DRIVE_PATH : SCRIBD_PATH).exec(rawPath)?.[1];
  if (!id) throw invalid();
  return drive
    ? {provider: 'DRIVE', sourceId: id, canonicalUrl: `https://drive.google.com/file/d/${id}/view`}
    : {provider: 'SCRIBD', sourceId: id, canonicalUrl: `https://www.scribd.com/embeds/${id}/content`};
}

const invalid = () => new ToolError('INVALID_URL');

// ---- RequestGuard ----
// Decides which browser requests may leave the sandboxed page (SSRF guard for redirects and subresources).
// ponytail: name-based only, no DNS resolution check (wildcard DNS like 127.0.0.1.nip.io or rebinding hosts pass);
// resolve the host and reject loopback/site-local/link-local addresses if that threat matters.

// TLD-like last label must start with a letter: rejects IPv4, decimal/hex IP forms and IPv6 literals.
const NAMED_HOST = /^[a-z0-9-]+([.][a-z0-9-]+)*[.][a-z][a-z0-9-]*$/;
// Only scheme + authority are parsed: Chromium sends query chars (|, {, }, ^) that a strict URI parser rejects.
// Internal-only pseudo-TLDs (cloud metadata, mDNS, home/corp networks) are never legitimate page resources.
const INTERNAL_SUFFIXES = ['.internal', '.local', '.lan', '.localdomain', '.home.arpa', '.corp', '.intranet'];
const SCHEME_AUTHORITY = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)/;

export function allow(url: string, mainFrameNavigation: boolean): boolean {
  const m = SCHEME_AUTHORITY.exec(url);
  if (!m) return false;
  const scheme = m[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') return false;
  const auth = parseAuthority(m[2]);
  if (!auth) return false;
  const host = (auth.host ?? '').toLowerCase();
  const bare = host.endsWith('.') ? host.slice(0, -1) : host;
  if (INTERNAL_SUFFIXES.some((s) => bare.endsWith(s))) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || !NAMED_HOST.test(host)) return false;
  return !mainFrameNavigation || isAllowedHost(host);
}

/** Route handlers only see the first hop of a redirect chain, so re-check where the main frame landed. */
export function requireAllowedMainFrame(finalUrl: string): void {
  if (!allow(finalUrl, true)) throw new ToolError('PROVIDER_EXTRACTION_FAILED');
}
