import type {Page} from 'patchright';
import {ToolError} from './errors.ts';
import {openDocument, requireNoChallenge, withPage} from './browser.ts';
import type {Deadline, Extractor} from './runner.ts';

// patchright evaluates in an isolated world by default (DOM shared, page JS globals hidden). Calls that need the
// page's own globals (Scribd's docManager) pass this flag to run in the main world, like plain Playwright does.
const MAIN_WORLD = false;

// ---------------- Google Drive ----------------
// Ported from GoogleDriveExtractor.java (legacy GoogleDriveUtil), with loop caps and a cooperative deadline.

const DRIVE_MAX_SCROLLS = 400;
const DRIVE_MAX_PAGES = 500;
// page.evaluate has no timeout and Deadline.check() cannot run inside it, so in-page waits get fixed budgets.
// ponytail: fixed budgets, not the job's remaining time; pass Deadline's remaining ms if jobs get tighter.
const IMAGE_FETCH_BUDGET_MS = 120_000;
const PDF_IMAGE_WAIT_MS = 30_000;
// Data URIs are one-byte (Latin-1) strings in V8 (~1 byte/char); stop before holding more than the 100MB file cap.
const MAX_IMAGE_CHARS = 100 * 1024 * 1024;

export function driveExtractor(headless: boolean): Extractor {
  return {
    provider: 'DRIVE',
    extract: (job, deadline, progress, screenshot, navigation) => withPage(headless, async (page) => {
      progress('OPENING', 5);
      await openDocument(page, job.canonicalUrl);
      await page.waitForTimeout(3000);
      deadline.check();

      progress('SCROLLING', 20);
      await scrollToLoadAllPages(page, deadline);

      progress('EXTRACTING', 60);
      const images = await fetchBlobImagesAsBase64(page);
      if (images.length === 0) throw new ToolError('PROVIDER_EXTRACTION_FAILED');
      deadline.check();

      progress('RENDERING', 80);
      const pdf = await buildPdfFromImages(page, images, deadline);
      return {pdf, displayName: await extractTitle(page, job.sourceId)};
    }, screenshot, navigation),
  };
}

async function scrollToLoadAllPages(page: Page, deadline: Deadline): Promise<void> {
  await page.evaluate(() => {
    let best: HTMLDivElement | null = null, maxSH = 0;
    for (const d of document.querySelectorAll('div')) {
      const ov = getComputedStyle(d).overflowY;
      if (['auto', 'scroll', 'overlay'].includes(ov)
          && d.scrollHeight > d.clientHeight + 100
          && d.scrollHeight > maxSH) {
        maxSH = d.scrollHeight;
        best = d;
      }
    }
    (window as unknown as {__sc: Element | null}).__sc = best;
  });

  const coords = await page.evaluate(() => {
    const el = (window as unknown as {__sc: Element | null}).__sc;
    if (el) {
      const r = el.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2];
    }
    return [window.innerWidth / 2, window.innerHeight / 2];
  });
  if (Array.isArray(coords) && coords.length === 2) {
    await page.mouse.click(Number(coords[0]), Number(coords[1]));
    await page.waitForTimeout(300);
  }

  let stable = 0;
  let last = 0;
  for (let i = 0; i < DRIVE_MAX_SCROLLS && stable < 8; i++) {
    deadline.check();
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(1000);
    const pos = await page.evaluate(() =>
      (window as unknown as {__sc?: Element | null}).__sc?.scrollTop ?? document.scrollingElement?.scrollTop ?? window.scrollY);
    const current = typeof pos === 'number' ? pos : 0;
    if (Math.abs(current - last) < 5) {
      stable++;
    } else {
      stable = 0;
      last = current;
    }
  }
}

/** Blob images cannot be fetched directly; draw each onto a canvas and export as JPEG data URI. */
async function fetchBlobImagesAsBase64(page: Page): Promise<string[]> {
  const result: unknown = await page.evaluate(async ({maxPages, budgetMs, maxChars}) => {
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>('img[src^="blob:https://drive.google.com/"]'),
    ).slice(0, maxPages);
    const end = Date.now() + budgetMs;
    const images: string[] = [];
    let chars = 0;
    for (const img of imgs) {
      const left = end - Date.now();
      if (left <= 0) break;
      try {
        if (!img.complete || img.naturalWidth === 0) {
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, Math.min(8000, left));
          });
        }
        if (img.naturalWidth === 0) continue;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        const uri = canvas.toDataURL('image/jpeg', 0.92);
        chars += uri.length;
        if (chars > maxChars) return {images: [], tooLarge: true};
        images.push(uri);
      } catch {
        // skip unreadable image
      }
    }
    return {images, tooLarge: false};
  }, {maxPages: DRIVE_MAX_PAGES, budgetMs: IMAGE_FETCH_BUDGET_MS, maxChars: MAX_IMAGE_CHARS});
  if (!result || typeof result !== 'object') return [];
  const r = result as {images?: unknown; tooLarge?: unknown};
  if (r.tooLarge === true) throw new ToolError('FILE_TOO_LARGE');
  if (!Array.isArray(r.images)) return [];
  return r.images.filter((s): s is string => typeof s === 'string' && s.startsWith('data:image/'));
}

async function buildPdfFromImages(drivePage: Page, images: string[], deadline: Deadline): Promise<Uint8Array> {
  let html = `<!DOCTYPE html><html><head><style>
    @page { margin: 0; size: A4 portrait; }
    html, body { margin: 0; padding: 0; background: white; }
    .page { width: 210mm; height: 297mm; overflow: hidden; display: flex; align-items: center;
            justify-content: center; page-break-after: always; page-break-inside: avoid; }
    .page:last-child { page-break-after: auto; }
    .page img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style></head><body>
`;
  for (const img of images) html += `<div class="page"><img src="${img}"></div>`;
  html += '</body></html>';

  // Fresh about:blank page so Drive's Trusted-Types CSP does not block setContent.
  const pdfPage = await drivePage.context().newPage();
  try {
    await pdfPage.setContent(html);
    await pdfPage.waitForLoadState();
    await pdfPage.evaluate(async (waitMs) => {
      const wait = Promise.all(Array.from(document.images).map((img) => {
        if (img.complete) return;
        return new Promise((r) => { img.onload = r; img.onerror = r; });
      }));
      await Promise.race([wait, new Promise((r) => setTimeout(r, waitMs))]);
    }, PDF_IMAGE_WAIT_MS);
    deadline.check();
    return await pdfPage.pdf({format: 'A4', printBackground: true,
      margin: {top: '0mm', bottom: '0mm', left: '0mm', right: '0mm'}});
  } finally {
    await pdfPage.close().catch(() => {});
  }
}

async function extractTitle(page: Page, fallbackId: string): Promise<string> {
  const title = await page.evaluate(() => document.title);
  if (typeof title !== 'string' || title.trim() === '') return `drive_${fallbackId}`;
  return title.replaceAll(' - Google Drive', '').replaceAll('.pdf', '').trim();
}

// ---------------- Scribd ----------------
// Ported from ScribdExtractor.java (legacy ScribdUtil/ScribdController), with page-count cap and a cooperative deadline.

const SCRIBD_MAX_PAGES = 500;

declare const docManager: {_pageCount?: number; gotoNextPage(): void} | undefined;

export function scribdExtractor(headless: boolean): Extractor {
  return {
    provider: 'SCRIBD',
    extract: (job, deadline, progress, screenshot, navigation) => withPage(headless, async (page) => {
      progress('OPENING', 5);
      await openDocument(page, job.canonicalUrl);
      await page.evaluate(() => document.querySelector<HTMLElement>('button.osano-cm-accept-all')?.click());
      deadline.check();

      const total = await page.evaluate(
        () => (typeof docManager !== 'undefined' && docManager._pageCount) || 0, undefined, undefined, MAIN_WORLD);
      const pages = typeof total === 'number' ? Math.min(Math.trunc(total), SCRIBD_MAX_PAGES) : 0;
      if (pages <= 0) {
        await requireNoChallenge(page);
        throw new ToolError('PROVIDER_EXTRACTION_FAILED');
      }
      for (let current = 1; current < pages; current++) {
        deadline.check();
        await page.evaluate(() => docManager!.gotoNextPage(), undefined, undefined, MAIN_WORLD);
        await page.waitForTimeout(500);
        progress('SCROLLING', 10 + Math.trunc((70 * current) / pages));
      }

      progress('RENDERING', 85);
      await page.evaluate(() => {
        document.querySelectorAll('.document_scroller').forEach((el) => { el.className = ''; });
        ['toolbar_drop', 'mobile_overlay'].forEach((cls) => {
          document.querySelectorAll('.' + cls).forEach((el) => el.remove());
        });
      });
      await page.evaluate(async () => {
        const wait = Promise.all(Array.from(document.images).map((img) =>
          img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; })));
        await Promise.race([wait, new Promise((res) => setTimeout(res, 20000))]);
      });
      deadline.check();
      const pdf = await page.pdf({format: 'A4', printBackground: true,
        margin: {top: '10mm', bottom: '10mm', left: '10mm', right: '10mm'}});
      const title = await page.title();
      return {pdf, displayName: title.trim() === '' ? `scribd_${job.sourceId}` : title};
    }, screenshot, navigation),
  };
}
