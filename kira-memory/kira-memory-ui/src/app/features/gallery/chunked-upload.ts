import {HttpErrorResponse, HttpEventType} from '@angular/common/http';
import {firstValueFrom, last, tap} from 'rxjs';
import {Api, Media} from '../../core/api';

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

export interface Progress { (phase: 'sending' | 'storing', percent: number): void; }

/**
 * Sends the file in the server's chunk size (each chunk retried on its own, so one dropped connection does not
 * restart 2 GB), completes with the details, then waits while the server stores it.
 */
export async function chunkedUpload(api: Api, file: File, details: FormData, onProgress: Progress): Promise<Media> {
  const type = contentTypeOf(file);
  let session = await firstValueFrom(api.createUpload(type, file.size));
  const id = session.uploadId;
  let sent = 0;
  for (const index of session.missingChunks) {
    const chunk = file.slice(index * session.chunkSize, Math.min(file.size, (index + 1) * session.chunkSize));
    for (let attempt = 1; ; attempt++) {
      try {
        await firstValueFrom(api.putChunk(id, index, chunk).pipe(
          tap(ev => {
            if (ev.type === HttpEventType.UploadProgress) onProgress('sending', Math.floor((sent + ev.loaded) / file.size * 100));
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
    onProgress('sending', Math.floor(sent / file.size * 100));
  }
  session = await firstValueFrom(api.completeUpload(id, details));
  onProgress('storing', 100);
  for (let polls = 0; ; polls++) {
    if (session.state === 'DONE' && session.media) return session.media;
    if (session.state === 'FAILED') throw {error: {message: session.error ?? 'Không lưu được file, hãy thử lại'}};
    await wait(Math.min(5000, 1000 + polls * 250));
    try {
      session = await firstValueFrom(api.uploadStatus(id));
    } catch (err) {
      if (!retryable(err)) throw err;
    }
  }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
