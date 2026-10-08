// Prints content.js as a bookmarklet URL. Usage: node make-bookmarklet.mjs | pbcopy
import { readFileSync } from 'node:fs';

const src = `globalThis.kiraBookmarklet=1;${readFileSync(new URL('content.js', import.meta.url), 'utf8')}`;
new Function(src); // self-check: throws on a syntax error instead of emitting a dead bookmark
process.stdout.write(`javascript:${encodeURIComponent(src)}`);
