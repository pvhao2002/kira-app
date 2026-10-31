export const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const num = (n: number) => new Intl.NumberFormat('en').format(n);
export const duration = (sec: number) =>
  sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
export const date = (unix: number | null) =>
  unix ? new Date(unix * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
export const ago = (unix: number) => {
  const s = Math.max(0, Date.now() / 1000 - unix);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
