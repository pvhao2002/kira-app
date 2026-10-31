import { useState } from 'react';
import { Link } from 'react-router';
import { useApi } from '../../api';
import { csvCell } from '../../csv';
import { DifficultyBadge, ErrorBox, Spinner } from '../../components/Badge';
import { ago, compact, duration, num } from '../../format';
import type { Difficulty } from '../../types';

type Data = {
  days: number;
  kpis: { views: number; viewsChange: number | null; uniques: number; uniquesChange: number | null; avgSeconds: number; completion: number; active: number; bookmarks: number; bookmarksRecent: number; questions: number };
  daily: { day: string; category: string; views: number }[];
  domains: { category: string; views: number }[];
  topArticles: { slug: string; title: string; difficulty: Difficulty; source: string; category: string; views: number; uniques: number; avg_seconds: number; completion: number; views_7d: number }[];
  countries: { country: string; code: string | null; views: number; visitors: number }[];
  cities: { city: string; region: string; code: string; visitors: number }[];
  referrers: { source: string; views: number }[];
  recent: { at: number; path: string; ip: string; city: string | null; country: string | null; code: string | null; isp: string | null; timezone: string | null }[];
};

const RANGES = [[1, '24H'], [7, '7D'], [30, '30D'], [90, '90D']] as const;
const COLORS = ['#818cf8', '#4edea3', '#d0bcff', '#fbbf24', '#22d3ee', '#fb7185', '#64748b'];
const flag = (code: string | null) => (code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐');
const card = 'p-space-md rounded-xl bg-surface-container-low';

function Change({ v }: { v: number | null }) {
  if (v === null) return <span className="font-label-caps text-label-caps text-outline">no prior data</span>;
  const up = v >= 0;
  return (
    <span className={`flex items-center font-label-caps text-label-caps ${up ? 'text-secondary' : 'text-error'}`}>
      <span className="material-symbols-outlined text-title-md">{up ? 'trending_up' : 'trending_down'}</span>{up ? '+' : ''}{v}%
    </span>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, error, reload, loading } = useApi<Data>(`/admin/analytics?days=${days}`);

  function exportCsv() {
    if (!data) return;
    const rows = [['title', 'category', 'difficulty', 'views', 'unique_visitors', 'avg_read_seconds', 'completion_pct', 'views_7d'], ...data.topArticles.map((a) => [a.title, a.category, a.difficulty, a.views, a.uniques, Math.round(a.avg_seconds), Math.round(a.completion), a.views_7d])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `knowstack-analytics-${days}d.csv` }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-2 font-label-caps text-label-caps text-outline uppercase">
            Admin Studio · Traffic & Engagement Telemetry
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-secondary normal-case"><span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />{data?.kpis.active ?? 0} active now</span>
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">Traffic & Content Analytics</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">Reader telemetry, article engagement and visitor geography (resolved once per IP via ip-api.com).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="flex p-1 bg-surface-container-low rounded-xl">
            {RANGES.map(([v, t]) => (
              <button key={v} role="tab" aria-selected={days === v} type="button" onClick={() => setDays(v)} className={`px-3 py-1 rounded-lg font-badge-label text-badge-label ${days === v ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant'}`}>{t}</button>
            ))}
          </div>
          <button type="button" onClick={reload} aria-label="Refresh" className="w-9 h-9 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface"><span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span></button>
          <button type="button" onClick={exportCsv} disabled={!data} className="flex items-center gap-1.5 px-space-md h-9 rounded-xl bg-primary text-on-primary font-badge-label text-badge-label"><span className="material-symbols-outlined text-title-md">download</span>Export CSV</button>
        </div>
      </header>

      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
            <Kpi label="Total Page Views" value={num(data.kpis.views)} extra={<Change v={data.kpis.viewsChange} />} sub={`${compact(data.kpis.uniques)} unique visitors`} />
            <Kpi label="Unique Visitors (by IP)" value={num(data.kpis.uniques)} extra={<Change v={data.kpis.uniquesChange} />} sub={data.kpis.uniques ? `${(data.kpis.views / data.kpis.uniques).toFixed(2)} views / visitor` : '—'} />
            <Kpi label="Avg Read Duration" value={duration(data.kpis.avgSeconds)} extra={<span className="font-label-caps text-label-caps text-secondary">{data.kpis.completion}% complete</span>} sub="Completion = scrolled ≥ 90%" />
            <Kpi label="Bookmarks & Questions" value={num(data.kpis.bookmarks)} extra={<span className="font-label-caps text-label-caps text-secondary">+{data.kpis.bookmarksRecent}</span>} sub={`${data.kpis.questions} questions submitted in range`} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-space-md">
            <DailyChart data={data} />
            <section className={card}>
              <h2 className="font-title-md text-title-md text-on-surface">Domain Share</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Article views by engineering pillar.</p>
              <Bars rows={data.domains.map((d) => ({ label: d.category, value: d.views }))} empty="No article views yet" />
            </section>
          </div>

          <section className={`${card} overflow-x-auto`}>
            <h2 className="font-title-md text-title-md text-on-surface">High-Yield Technical Articles</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Top content by views in range, with read depth and 7-day velocity.</p>
            <table className="w-full min-w-[760px] text-left font-body-sm text-body-sm">
              <thead className="text-outline">
                <tr className="border-b border-outline-variant/30">
                  {['Article', 'Domain / Difficulty', 'Views', 'Unique', 'Avg Read', 'Completion', '7D'].map((h) => <th key={h} className="py-2 pr-4 font-label-caps text-label-caps uppercase font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.topArticles.length === 0 && <tr><td colSpan={7} className="py-space-md text-outline">No article views in this range.</td></tr>}
                {data.topArticles.map((a) => (
                  <tr key={a.slug} className="border-b border-outline-variant/15 last:border-0">
                    <td className="py-3 pr-4">
                      <Link to={`/articles/${a.slug}`} className="text-on-surface hover:text-primary font-semibold">{a.title}</Link>
                      <span className="block text-outline font-label-caps text-label-caps">{a.source === 'ai' ? 'AI AGENT' : 'HUMAN'} · {a.slug}</span>
                    </td>
                    <td className="py-3 pr-4"><span className="block text-on-surface-variant mb-1">{a.category}</span><DifficultyBadge level={a.difficulty} /></td>
                    <td className="py-3 pr-4 text-on-surface">{num(a.views)}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">{num(a.uniques)}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">{duration(Math.round(a.avg_seconds))}</td>
                    <td className="py-3 pr-4 text-secondary">{Math.round(a.completion)}%</td>
                    <td className="py-3 pr-4 text-on-surface-variant">{num(a.views_7d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
            <section className={card}>
              <h2 className="font-title-md text-title-md text-on-surface mb-space-md flex items-center gap-2"><span className="material-symbols-outlined text-primary">public</span>Visitor Countries</h2>
              <Bars rows={data.countries.map((c) => ({ label: `${flag(c.code)} ${c.country}`, value: c.views, note: `${c.visitors} IPs` }))} empty="No visits yet" />
            </section>
            <section className={card}>
              <h2 className="font-title-md text-title-md text-on-surface mb-space-md flex items-center gap-2"><span className="material-symbols-outlined text-primary">location_city</span>Top Cities</h2>
              <Bars rows={data.cities.map((c) => ({ label: `${flag(c.code)} ${c.city}${c.region ? `, ${c.region}` : ''}`, value: c.visitors }))} empty="No geolocated visitors yet (local/private IPs are skipped)" />
            </section>
            <section className={card}>
              <h2 className="font-title-md text-title-md text-on-surface mb-space-md flex items-center gap-2"><span className="material-symbols-outlined text-primary">share</span>Referral Channels</h2>
              <Bars rows={data.referrers.map((r) => ({ label: r.source, value: r.views }))} empty="No visits yet" />
            </section>
          </div>

          <section className={`${card} overflow-x-auto`}>
            <h2 className="font-title-md text-title-md text-on-surface mb-space-md">Recent Visitors</h2>
            <table className="w-full min-w-[720px] text-left font-body-sm text-body-sm">
              <thead className="text-outline">
                <tr className="border-b border-outline-variant/30">{['When', 'Page', 'IP', 'Location', 'ISP', 'Timezone'].map((h) => <th key={h} className="py-2 pr-4 font-label-caps text-label-caps uppercase font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.recent.map((v, i) => (
                  <tr key={i} className="border-b border-outline-variant/15 last:border-0 text-on-surface-variant">
                    <td className="py-2 pr-4 whitespace-nowrap">{ago(v.at)}</td>
                    <td className="py-2 pr-4 font-code-inline text-code-inline text-on-surface truncate max-w-56">{v.path}</td>
                    <td className="py-2 pr-4 font-code-inline text-code-inline">{v.ip}</td>
                    <td className="py-2 pr-4">{v.country ? `${flag(v.code)} ${v.city ?? ''}, ${v.country}` : <span className="text-outline">Unknown</span>}</td>
                    <td className="py-2 pr-4">{v.isp ?? '—'}</td>
                    <td className="py-2 pr-4">{v.timezone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, extra, sub }: { label: string; value: string; extra: React.ReactNode; sub: string }) {
  return (
    <div className={`${card} flex flex-col gap-1`}>
      <span className="font-label-caps text-label-caps text-outline uppercase">{label}</span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-headline-lg text-headline-lg text-on-surface">{value}</span>
        {extra}
      </div>
      <span className="font-body-sm text-body-sm text-on-surface-variant">{sub}</span>
    </div>
  );
}

function Bars({ rows, empty }: { rows: { label: string; value: number; note?: string }[]; empty: string }) {
  if (!rows.length) return <p className="font-body-sm text-body-sm text-outline">{empty}</p>;
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.label} className="flex flex-col gap-1">
          <div className="flex justify-between gap-2 font-body-sm text-body-sm">
            <span className="text-on-surface truncate">{r.label}</span>
            <span className="text-on-surface-variant whitespace-nowrap">{Math.round((r.value / total) * 100)}% ({compact(r.value)}){r.note ? ` · ${r.note}` : ''}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.value / total) * 100}%`, background: COLORS[i % COLORS.length] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DailyChart({ data }: { data: Data }) {
  const cats = [...new Set(data.daily.map((d) => d.category))];
  const days: string[] = [];
  for (let i = Math.max(data.days, 1) - 1; i >= 0; i--) days.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10));
  const byDay = new Map(days.map((d) => [d, new Map<string, number>()]));
  for (const r of data.daily) byDay.get(r.day)?.set(r.category, r.views);
  const totals = days.map((d) => [...byDay.get(d)!.values()].reduce((s, v) => s + v, 0));
  const max = Math.max(1, ...totals);
  const peak = totals.indexOf(Math.max(...totals));

  return (
    <section className={`${card} xl:col-span-2 flex flex-col`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-title-md text-title-md text-on-surface">Daily Volume Trend</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Page views per day, by category (UTC).</p>
        </div>
        <ul className="flex flex-wrap gap-3">
          {cats.map((c, i) => <li key={c} className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />{c}</li>)}
        </ul>
      </div>
      <div className="flex-1 flex items-end gap-[2px] h-56 mt-space-md" role="img" aria-label={`Daily views, peak ${max} on ${days[peak]}`}>
        {days.map((d, i) => (
          <div key={d} className="flex-1 h-full flex flex-col justify-end group relative" title={`${d}: ${totals[i]} views`}>
            {cats.map((c, ci) => {
              const v = byDay.get(d)!.get(c) ?? 0;
              return v ? <div key={c} style={{ height: `${(v / max) * 100}%`, background: COLORS[ci % COLORS.length] }} className="w-full first:rounded-t-sm opacity-85 group-hover:opacity-100" /> : null;
            })}
            {!totals[i] && <div className="w-full h-px bg-outline-variant/40" />}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 font-label-caps text-label-caps text-outline">
        <span>{days[0]}</span>
        {totals[peak] > 0 && <span className="text-secondary">PEAK {days[peak]} · {totals[peak]}</span>}
        <span>TODAY</span>
      </div>
    </section>
  );
}
