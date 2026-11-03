import { clampRps } from './lib.js';

/** https anywhere, plain http only for localhost: the bearer token must not travel in cleartext. */
export function validBaseUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'https:'
      || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname));
  } catch (_) {
    return false;
  }
}

// Guard keeps the module importable from node (test/check.mjs) for validBaseUrl.
if (globalThis.chrome?.storage) {
  const $ = (id) => document.getElementById(id);
  const s = await chrome.storage.local.get({ baseUrl: '', token: '', rps: 1 });
  $('baseUrl').value = s.baseUrl;
  $('token').value = s.token;
  $('rps').value = clampRps(s.rps);

  $('save').addEventListener('click', async () => {
    const baseUrl = $('baseUrl').value.trim().replace(/\/+$/, '');
    if (baseUrl && !validBaseUrl(baseUrl)) {
      $('msg').textContent = 'Base URL must be https:// (http:// only for localhost). Not saved.';
      return;
    }
    // permissions.request needs the user gesture: call it before any other await.
    let granted = true;
    if (baseUrl) {
      try {
        granted = await chrome.permissions.request({ origins: [new URL(baseUrl).origin + '/*'] });
      } catch (_) {
        granted = false;
      }
    }
    const rps = clampRps($('rps').value);
    $('rps').value = rps;
    await chrome.storage.local.set({ baseUrl, token: $('token').value.trim(), rps });
    $('msg').textContent = granted
      ? 'Saved. Reload the extension to apply the new rate.'
      : 'Saved, but permission denied: backend calls will fail.';
  });
}
