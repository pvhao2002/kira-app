import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { studyMode, TrackDirectory } from './components/Study';

describe('study workspace', () => {
  it('distinguishes directory, saved, track, search and workspace destinations', () => {
    expect(studyMode('/tracks', '')).toBe('tracks');
    expect(studyMode('/', 'bookmarked=1')).toBe('saved');
    expect(studyMode('/tracks/java', '')).toBe('track');
    expect(studyMode('/', 'q=locks')).toBe('results');
    expect(studyMode('/', 'difficulty=senior')).toBe('results');
    expect(studyMode('/', '')).toBe('workspace');
  });
  it('renders real counts and an empty track destination', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(TrackDirectory, { categories: [
      { slug: 'java', name: 'Java & Spring', icon: 'code', count: 3 },
      { slug: 'cloud', name: 'Cloud', icon: 'cloud', count: 0 },
    ] })));
    expect(html).toContain('/tracks/java');
    expect(html).toContain('/tracks/cloud');
    expect(html).toContain('3 guides');
    expect(html).toContain('No guides yet');
    expect(html).not.toContain('completed');
  });
});

it('renders loading and errors without a remote icon font', async () => {
  const { Spinner, ErrorBox } = await import('./components/Badge');
  const loading = renderToStaticMarkup(createElement(Spinner));
  const error = renderToStaticMarkup(createElement(ErrorBox, { message: 'Connection failed' }));
  expect(loading).toContain('role="status"');
  expect(loading).toContain('<svg');
  expect(error).toContain('role="alert"');
  expect(error).toContain('Connection failed');
  expect(error).not.toContain('material-symbols');
});
