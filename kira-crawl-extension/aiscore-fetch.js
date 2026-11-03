// Injected into a www.aiscore.com tab (ISOLATED world) via chrome.scripting.executeScript({func}).
// MUST be self-contained. The backend token is never passed here. Port of SINGLE_FETCH_SCRIPT.
export async function aiscoreFetch(url) {
  const toBase64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };
  try {
    const res = await fetch(url, { credentials: 'include' });
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || '';
    const mitigated = res.headers.get('cf-mitigated') || '';
    const html = /text\/html|application\/xhtml\+xml/i.test(contentType);
    const sample = html ? new TextDecoder().decode(buf.slice(0, 8192)) : '';
    return {
      status: res.status,
      contentType,
      mitigated,
      sample,
      body: res.ok && buf.byteLength > 0 ? toBase64(buf) : null,
    };
  } catch (err) {
    return { status: 0, contentType: '', mitigated: '', sample: '', body: null, error: String(err) };
  }
}
