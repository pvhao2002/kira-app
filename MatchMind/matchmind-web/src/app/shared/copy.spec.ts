import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './kit';
import { CopyFallback, CopyService } from './copy';

describe('CopyService (UX-091)', () => {
  afterEach(() => { Reflect.deleteProperty(navigator, 'clipboard'); vi.restoreAllMocks(); });

  it('uses the clipboard API when there is one', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const toast = vi.spyOn(TestBed.inject(ToastService), 'add');
    expect(await TestBed.inject(CopyService).copy('secret text', 'Prompt')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('secret text');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success', summary: 'Copied' }));
  });

  it('without a clipboard (plain HTTP on a LAN) shows the text in a dialog to copy by hand', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    const copy = TestBed.inject(CopyService);
    expect(await copy.copy('the prompt', 'Prompt')).toBe(false);
    expect(copy.manual()).toEqual(expect.objectContaining({ text: 'the prompt', what: 'Prompt' }));

    const f = TestBed.createComponent(CopyFallback);
    await f.whenStable();
    const area = document.querySelector('textarea[readonly]') as HTMLTextAreaElement;
    expect(area.value).toBe('the prompt');
    copy.close();
    expect(copy.manual()).toBeNull();
    f.destroy();
  });
});
