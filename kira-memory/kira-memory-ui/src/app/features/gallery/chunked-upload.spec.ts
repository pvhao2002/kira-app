import {HttpErrorResponse} from '@angular/common/http';
import {contentTypeOf, inTurn, retryable} from './chunked-upload';

describe('chunked upload helpers', () => {
  it('falls back to the extension when the browser gives no type', () => {
    expect(contentTypeOf(new File([], 'IMG_0001.HEIC'))).toBe('image/heic');
    expect(contentTypeOf(new File([], 'clip.mov', {type: 'video/quicktime'}))).toBe('video/quicktime');
    expect(contentTypeOf(new File([], 'notes.txt'))).toBe('application/octet-stream');
  });

  it('retries network and server errors only', () => {
    expect(retryable(new HttpErrorResponse({status: 0}))).toBe(true);
    expect(retryable(new HttpErrorResponse({status: 503}))).toBe(true);
    expect(retryable(new HttpErrorResponse({status: 400}))).toBe(false);
    expect(retryable(new HttpErrorResponse({status: 404}))).toBe(false);
  });
});

describe('inTurn', () => {
  /** Lets every pending promise callback run. */
  const flush = () => new Promise(r => setTimeout(r));

  it('sends the next file while earlier ones are stored, at most 3 at once', async () => {
    const log: string[] = [];
    const stores = new Map<number, () => void>();
    let finished = false;
    const all = inTurn([1, 2, 3, 4, 5],
      async n => {
        log.push('send ' + n);
        return true;
      },
      n => {
        log.push('store ' + n);
        return new Promise<void>(ok => stores.set(n, ok));
      }).then(() => (finished = true));

    await flush();
    expect(log).toEqual(['send 1', 'store 1', 'send 2', 'store 2', 'send 3', 'store 3']);
    stores.get(1)!();
    await flush();
    expect(log.slice(6)).toEqual(['send 4', 'store 4']);
    [2, 3, 4].forEach(n => stores.get(n)!());
    await flush();
    expect(log.slice(8)).toEqual(['send 5', 'store 5']);
    expect(finished).toBe(false);
    stores.get(5)!();
    await all;
    expect(finished).toBe(true);
  });

  it('skips storing for items that failed to send', async () => {
    const stored: number[] = [];
    await inTurn([1, 2, 3], async n => n !== 2, async n => {
      stored.push(n);
    });
    expect(stored).toEqual([1, 3]);
  });
});
