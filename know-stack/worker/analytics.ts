type Row = Record<string, number | string | null>;

/** Dashboard data for the last `days` days, compared with the `days` before that. */
export async function analytics(db: D1Database, days: number) {
  const now = Math.floor(Date.now() / 1000);
  const since = now - days * 86400;
  const prevSince = since - days * 86400;
  const q = (sql: string, ...binds: unknown[]) => db.prepare(sql).bind(...binds);

  const results = await db.batch<Row>([
    // 0: current window KPIs
    q(`select count(*) views, count(distinct ip) uniques,
         coalesce(avg(case when article_id is not null and seconds > 0 then seconds end), 0) avg_seconds,
         coalesce(100.0 * sum(case when article_id is not null and scroll_pct >= 90 then 1 else 0 end)
           / nullif(sum(case when article_id is not null and scroll_pct > 0 then 1 else 0 end), 0), 0) completion
       from visits where created_at >= ?`, since),
    // 1: previous window
    q(`select count(*) views, count(distinct ip) uniques from visits where created_at >= ? and created_at < ?`, prevSince, since),
    // 2: active in the last 5 minutes
    q(`select count(distinct ip) active from visits where created_at >= ?`, now - 300),
    // 3: bookmarks
    q(`select count(*) total, sum(case when created_at >= ? then 1 else 0 end) recent from bookmarks`, since),
    // 4: questions in window
    q(`select count(*) n from questions where created_at >= ?`, since),
    // 5: daily views per category
    q(`select date(v.created_at, 'unixepoch') day, coalesce(c.name, 'Other pages') category, count(*) views
       from visits v left join articles a on a.id = v.article_id left join categories c on c.slug = a.category_slug
       where v.created_at >= ? group by day, category order by day`, since),
    // 6: domain share (article views only)
    q(`select c.name category, count(*) views from visits v join articles a on a.id = v.article_id
       join categories c on c.slug = a.category_slug where v.created_at >= ? group by c.name order by views desc`, since),
    // 7: top articles
    q(`select a.slug, a.title, a.difficulty, a.source, c.name category, count(*) views, count(distinct v.ip) uniques,
         coalesce(avg(case when v.seconds > 0 then v.seconds end), 0) avg_seconds,
         coalesce(100.0 * sum(case when v.scroll_pct >= 90 then 1 else 0 end) / nullif(sum(case when v.scroll_pct > 0 then 1 else 0 end), 0), 0) completion,
         sum(case when v.created_at >= ? then 1 else 0 end) views_7d
       from visits v join articles a on a.id = v.article_id join categories c on c.slug = a.category_slug
       where v.created_at >= ? group by a.id order by views desc limit 10`, now - 7 * 86400, since),
    // 8: countries (from ip-api cache)
    q(`select coalesce(g.country, 'Unknown') country, g.country_code code, count(*) views, count(distinct v.ip) visitors
       from visits v left join ip_geo g on g.ip = v.ip and g.status = 'success'
       where v.created_at >= ? group by country, code order by views desc limit 10`, since),
    // 9: cities
    q(`select g.city, g.region_name region, g.country_code code, count(distinct v.ip) visitors
       from visits v join ip_geo g on g.ip = v.ip and g.status = 'success'
       where v.created_at >= ? group by g.city, g.region_name, g.country_code order by visitors desc limit 8`, since),
    // 10: referrers
    q(`select case when referrer = '' then 'Direct' else referrer end source, count(*) views
       from visits where created_at >= ? group by source order by views desc limit 6`, since),
    // 11: recent visitors with geo
    q(`select v.created_at at, v.path, v.ip, g.city, g.country, g.country_code code, g.isp, g.timezone
       from visits v left join ip_geo g on g.ip = v.ip and g.status = 'success' order by v.created_at desc limit 12`),
  ]);
  const r = results.map((x) => x.results);
  const [cur, prev, active, bm, qs] = [r[0][0], r[1][0], r[2][0], r[3][0], r[4][0]];
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);

  return {
    days,
    kpis: {
      views: Number(cur.views),
      viewsChange: pct(Number(cur.views), Number(prev.views)),
      uniques: Number(cur.uniques),
      uniquesChange: pct(Number(cur.uniques), Number(prev.uniques)),
      avgSeconds: Math.round(Number(cur.avg_seconds)),
      completion: Math.round(Number(cur.completion) * 10) / 10,
      active: Number(active.active),
      bookmarks: Number(bm.total),
      bookmarksRecent: Number(bm.recent ?? 0),
      questions: Number(qs.n),
    },
    daily: r[5],
    domains: r[6],
    topArticles: r[7],
    countries: r[8],
    cities: r[9],
    referrers: r[10],
    // Admin-only, but still mask the last octet: the dashboard never needs a full address.
    recent: r[11].map((v) => ({ ...v, ip: maskIp(String(v.ip)) })),
  };
}

export const maskIp = (ip: string) =>
  ip.includes(':') ? ip.split(':').slice(0, 3).join(':') + ':…' : ip.replace(/\.\d+$/, '.x');
