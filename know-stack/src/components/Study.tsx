import { Link } from 'react-router';
import type { Category } from '../types';
import { Icon } from './Icon';

export function studyMode(path: string, query: string) {
  if (path === '/tracks') return 'tracks';
  const params = new URLSearchParams(query);
  if (params.get('bookmarked') === '1') return 'saved';
  if (path.startsWith('/tracks/')) return 'track';
  if (['q', 'difficulty', 'tag', 'sort'].some((key) => params.get(key))) return 'results';
  return 'workspace';
}

export function TrackDirectory({ categories, compact = false }: { categories: Category[]; compact?: boolean }) {
  return <div className={`ks-tracks ${compact ? 'ks-tracks-compact' : ''}`}>
    {categories.map((c) => <Link className="ks-track" to={`/tracks/${c.slug}`} key={c.slug}>
      <span className="ks-track-symbol"><Icon name={c.icon} /></span>
      <span className="min-w-0"><strong>{c.name}</strong><small>{c.count ? `${c.count} ${c.count === 1 ? 'guide' : 'guides'}` : 'No guides yet'}</small></span>
      <Icon name="arrow_forward" className="ks-track-arrow" />
    </Link>)}
  </div>;
}
