import {mkdir, rename, rm, writeFile} from 'node:fs/promises';
import {statSync, unlinkSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {ToolError} from './errors.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const SCREENSHOT_TTL_MS = 15 * 60_000;
const MAX_SCREENSHOTS = 32;
const MAX_SCREENSHOT_BYTES = 1_048_576;

/** PDFs are stored by UUID. Short-lived screenshots stay in memory. */
export class FileStore {
  private readonly root: string;
  private readonly maxBytes: number;
  private readonly screenshots = new Map<string, {image: Buffer; expiresAt: number}>();

  constructor(root: string, maxBytes: number) {
    this.root = resolve(root);
    this.maxBytes = maxBytes;
  }

  pathFor(id: string): string {
    if (!UUID.test(id)) throw new Error('job id is not a canonical UUID');
    return join(this.root, `${id}.pdf`);
  }

  // ponytail: PDF arrives fully in memory, so the cap guards disk not heap; stream to tmp if heap pressure appears.
  // ponytail: a crash between write and rename leaves {id}.pdf.tmp, and a failed delete leaves {id}.pdf with no
  // live row; neither is swept. Add a startup/periodic orphan sweep of root if disk use creeps.
  async write(id: string, bytes: Uint8Array): Promise<number> {
    if (bytes.length > this.maxBytes) throw new ToolError('FILE_TOO_LARGE');
    const target = this.pathFor(id);
    const tmp = `${target}.tmp`;
    try {
      await mkdir(this.root, {recursive: true});
      await writeFile(tmp, bytes);
      await rename(tmp, target); // atomic on the same filesystem, replaces an existing target
      return bytes.length;
    } catch (e) {
      await rm(tmp, {force: true}).catch(() => {});
      throw e;
    }
  }

  find(id: string): string | null {
    const p = this.pathFor(id);
    return statSync(p, {throwIfNoEntry: false})?.isFile() ? p : null;
  }

  /** Best-effort: a locked/undeletable file must not block the caller's state change (fail/expire/remove). */
  delete(id: string): void {
    this.screenshots.delete(id);
    try {
      unlinkSync(this.pathFor(id));
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') console.warn(`file delete failed jobId=${id} reason=${code ?? 'unknown'}`);
    }
  }

  rememberScreenshot(id: string, image: Uint8Array): void {
    this.screenshots.delete(id);
    if (image.length > MAX_SCREENSHOT_BYTES) return;
    const now = Date.now();
    this.expireScreenshots(now);
    // ponytail: evict the oldest preview at 32 MiB worst-case; revisit if one instance needs more previews.
    const oldest = this.screenshots.keys().next().value;
    if (this.screenshots.size >= MAX_SCREENSHOTS && oldest !== undefined) this.screenshots.delete(oldest);
    this.screenshots.set(id, {image: Buffer.from(image), expiresAt: now + SCREENSHOT_TTL_MS});
  }

  screenshot(id: string): Buffer | null {
    const entry = this.screenshots.get(id);
    if (!entry) return null;
    if (entry.expiresAt > Date.now()) return entry.image;
    this.screenshots.delete(id);
    return null;
  }

  expireScreenshots(now: number): void {
    for (const [id, entry] of this.screenshots) {
      if (entry.expiresAt <= now) this.screenshots.delete(id);
    }
  }
}
