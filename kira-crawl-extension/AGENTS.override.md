# Kira Crawl Extension Guidelines

## Scope

Chrome MV3 extension, no build step, no dependencies. It fetches AiScore API bytes inside the operator's own
`www.aiscore.com` tab (carries `cf_clearance`) and forwards them base64-encoded to `kira-queue` `/queue/ext/**`.
All protobuf decoding, mapping and persistence stay in `kira-queue`. Loop A (every 10 min) refreshes today's match list;
loop B (every 5 min) refreshes odds for events within +/-1h of now. Timezone is Asia/Ho_Chi_Minh.

## Change Rules

- Never bypass Cloudflare: on a challenge, stop the run, pause, badge `!`, notify the operator. Never solve it automatically.
- Every AiScore request goes through the shared limiter (default 1 req/s, options 1-10).
- The backend token lives only in `chrome.storage.local` and the service worker; never inject it into a tab, never log it or payloads.
- `pageState` (lib.js) and `aiscoreFetch` (aiscore-fetch.js) are injected as functions: keep them self-contained.
- Keep `lib.js` pure (no `chrome.*`) so `test/check.mjs` can import it.
- Keep the `/ext/**` contract in sync with `kira-queue` `ExtensionCrawlController`.

## Verification

Run `node kira-crawl-extension/test/check.mjs`. Loading the unpacked extension and solving Cloudflare by hand is a manual
check and must not be done unless explicitly authorized.
