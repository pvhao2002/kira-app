import { afterEach, describe, expect, it, vi } from 'vitest';

describe('chart theme (UX-101)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('follows an OS light/dark switch mid-session instead of keeping the theme read at load', async () => {
    let dark = false;
    const listeners: (() => void)[] = [];
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() { return q.includes('dark') ? dark : false; },
      addEventListener: (_: string, fn: () => void) => { if (q.includes('dark')) listeners.push(fn); },
    }));
    vi.resetModules();
    await import('./chart');
    const { Chart } = await import('chart.js');
    const light = { color: Chart.defaults.color, border: Chart.defaults.borderColor };

    dark = true;
    listeners.forEach(fn => fn());
    expect(Chart.defaults.color).not.toBe(light.color);
    expect(Chart.defaults.borderColor).not.toBe(light.border);

    dark = false;
    listeners.forEach(fn => fn());
    expect(Chart.defaults.color).toBe(light.color);
  });
});
