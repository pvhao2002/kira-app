#!/usr/bin/env node
// DEV TOOLING ONLY: prints the current 6-digit TOTP code (RFC 6238, SHA1, 30 s) for a base32 secret.
// Usage: node totp.js [BASE32_SECRET]   (default: the dev seed secret APP_SEED_DEVELOPMENT_TOTP_SECRET)
const crypto = require('crypto');
const secret = (process.argv[2] || process.env.APP_SEED_DEVELOPMENT_TOTP_SECRET || 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')
  .replace(/[\s=]/g, '').toUpperCase();
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let bits = '';
for (const c of secret) {
  const v = A.indexOf(c);
  if (v < 0) { console.error('invalid base32 secret'); process.exit(1); }
  bits += v.toString(2).padStart(5, '0');
}
const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
const msg = Buffer.alloc(8);
msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
const h = crypto.createHmac('sha1', key).update(msg).digest();
const o = h[h.length - 1] & 0x0f;
const code = (h.readUInt32BE(o) & 0x7fffffff) % 1000000;
console.log(String(code).padStart(6, '0'));
