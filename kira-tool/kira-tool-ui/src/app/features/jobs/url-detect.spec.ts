import {detectProvider} from './url-detect';

describe('detectProvider', () => {
  const id = '1AbCdEfGhIjKlMnOpQrSt';

  it('detects Drive and Scribd', () => {
    expect(detectProvider(`https://drive.google.com/file/d/${id}/view?usp=sharing`).provider).toBe('DRIVE');
    expect(detectProvider('https://www.scribd.com/document/123456789/Title').provider).toBe('SCRIBD');
    expect(detectProvider('https://vi.scribd.com/doc/123456789/Title').provider).toBe('SCRIBD');
  });

  it('is empty for blank input', () => {
    expect(detectProvider('  ')).toEqual({provider: null, valid: false, hint: ''});
  });

  it('rejects look-alike and unsafe URLs', () => {
    for (const u of [
      `http://drive.google.com/file/d/${id}/view`,
      `https://drive.google.com.evil.com/file/d/${id}/view`,
      `https://drive.google.com@evil.com/file/d/${id}/view`,
      `https://drive.google.com:8443/file/d/${id}/view`,
      'https://127.0.0.1/document/123456789/x',
      'javascript:alert(1)',
      'not a url',
      `https://drive.google.com/file/d/%2e%2e/view`,
      'https://drive.google.com/other'
    ]) {
      const r = detectProvider(u);
      expect(r.valid, u).toBe(false);
      expect(r.hint, u).not.toBe('');
    }
  });

  it('mirrors server rejections that WHATWG URL would hide', () => {
    for (const u of [
      `https://drive.google.com:443/file/d/${id}/view`,
      `https://drive.google.com/file/d/${id}/view?a=b|c`,
      `https://drive.google.com/file/d/${id}/view?a=b c`
    ]) {
      expect(detectProvider(u).valid, u).toBe(false);
    }
  });

  it('accepts Scribd slugs with non-ASCII characters, like the server', () => {
    expect(detectProvider('https://vi.scribd.com/document/123456789/Tài-liệu').valid).toBe(true);
  });

  it('rejects over-long input', () => {
    expect(detectProvider(`https://drive.google.com/file/d/${id}/view?${'a'.repeat(2100)}`).valid).toBe(false);
  });
});
