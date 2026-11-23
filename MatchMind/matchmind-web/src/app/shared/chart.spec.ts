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

  it('exports token-based result and series colours, refreshed on a theme switch (DS-14)', async () => {
    let dark = false;
    const listeners: (() => void)[] = [];
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() { return q.includes('dark') ? dark : false; },
      addEventListener: (_: string, fn: () => void) => { if (q.includes('dark')) listeners.push(fn); },
    }));
    vi.resetModules();
    const { RESULT_COLORS, SERIES } = await import('./chart');
    const { Chart } = await import('chart.js');
    expect(Object.keys(RESULT_COLORS)).toEqual(['WIN', 'HALF_WIN', 'PUSH', 'VOID', 'HALF_LOSS', 'LOSS', 'PENDING']);
    expect(SERIES.length).toBe(8);
    const lightAccent = SERIES[0], lightWin = RESULT_COLORS['WIN'];
    expect(Chart.defaults.plugins.tooltip.borderWidth).toBe(0);

    dark = true;
    listeners.forEach(fn => fn());
    expect(SERIES[0]).not.toBe(lightAccent);
    expect(RESULT_COLORS['WIN']).not.toBe(lightWin);
    expect(Chart.defaults.plugins.tooltip.borderWidth).toBe(1);
  });
});
