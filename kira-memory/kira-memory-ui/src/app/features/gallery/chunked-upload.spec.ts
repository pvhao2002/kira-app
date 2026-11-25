import {HttpErrorResponse} from '@angular/common/http';
import {contentTypeOf, retryable} from './chunked-upload';

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
