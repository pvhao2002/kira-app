import {HttpErrorResponse, HttpEventType} from '@angular/common/http';
import {firstValueFrom, last, tap} from 'rxjs';
import {Api, Media, UploadStatus} from '../../core/api';

const RETRIES = 4;
export const MAX_BYTES = 2 * 1024 ** 3;

/** Some browsers leave File.type empty (HEIC on Chrome); fall back to the extension. */
const BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm'
};

export function contentTypeOf(file: File): string {
  return file.type || BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''] || 'application/octet-stream';
}

/** Network drops, timeouts and server hiccups are worth another try; a 4xx answer is not. */
export function retryable(err: unknown): boolean {
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** How many sent files may wait for the server to store them before the next one goes out. */
export const MAX_STORING = 3;

/**
 * Sends the file in the server's chunk size (each chunk retried on its own, so one dropped connection does not
 * restart 2 GB) and completes it with the details. Resolves once the bytes are on the server; storing goes on there.
 */
export async function sendUpload(api: Api, file: File, details: FormData, onProgress: (percent: number) => void): Promise<UploadStatus> {
  const session = await firstValueFrom(api.createUpload(contentTypeOf(file), file.size));
  const id = session.uploadId;
  let sent = 0;
  for (const index of session.missingChunks) {
    const chunk = file.slice(index * session.chunkSize, Math.min(file.size, (index + 1) * session.chunkSize));
    for (let attempt = 1; ; attempt++) {
      try {
        await firstValueFrom(api.putChunk(id, index, chunk).pipe(
          tap(ev => {
            if (ev.type === HttpEventType.UploadProgress) onProgress(Math.floor((sent + ev.loaded) / file.size * 100));
          }),
          last()
        ));
        break;
      } catch (err) {
        if (attempt >= RETRIES || !retryable(err)) throw err;
        await wait(1000 * 2 ** (attempt - 1));
      }
    }
    sent += chunk.size;
    onProgress(Math.floor(sent / file.size * 100));
  }
  return firstValueFrom(api.completeUpload(id, details));
}

/** Polls until the server has stored a completed upload in Hugging Face/R2. */
export async function awaitStored(api: Api, session: UploadStatus): Promise<Media> {
  for (let polls = 0; ; polls++) {
    if (session.state === 'DONE' && session.media) return session.media;
    if (session.state === 'FAILED') throw {error: {message: session.error ?? 'Không lưu được file, hãy thử lại'}};
    await wait(Math.min(5000, 1000 + polls * 250));
    try {
      session = await firstValueFrom(api.uploadStatus(session.uploadId));
    } catch (err) {
      if (!retryable(err)) throw err;
    }
  }
}

/**
 * Sends items one at a time (a big video never competes with photos for bandwidth), but the next one goes out while
 * the server still stores earlier ones, waiting only when MAX_STORING are pending. `send` resolves false when the
 * item failed (it is not stored); both callbacks report their own errors.
 */
export async function inTurn<T>(items: readonly T[], send: (item: T) => Promise<boolean>,
                                stored: (item: T) => Promise<void>): Promise<void> {
  const pending = new Set<Promise<void>>();
  for (const item of items) {
    while (pending.size >= MAX_STORING) await Promise.race(pending);
    if (!(await send(item))) continue;
    const s: Promise<void> = stored(item).finally(() => pending.delete(s));
    pending.add(s);
  }
  await Promise.all(pending);
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
