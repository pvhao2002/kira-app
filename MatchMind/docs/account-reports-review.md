# Account Management: report and chart review

Scope: the `/account` page (`matchmind-web/src/app/pages/account.ts`) and `GET /api/v1/account/transactions`
(`matchmind-api/src/main/java/com/matchmind/account/AccountTransactions.java`). This document is a proposal only. No
code was changed. `MatchMind/AGENTS.override.md` rules apply to every item: charts use `shared/chart.ts`, missing
numbers render as `—`, reports stay full-width and dense, read aggregates run in SQL with bound parameters, and money
is `BigDecimal`/`NUMERIC`.

## 1. What the screen shows today

The page has three panels:

1. **Import transactions**: upload 1 to 10 screenshots, then copy one AI prompt.
2. **Cash flow**: an All time / Weekly / Monthly toggle over one table. Its columns are Period, Deposits,
   Withdrawals, Bonuses and Profit / loss. Profit is green or red through `.win`/`.loss`.
3. **Transactions**: a paged list of 25 rows with Date, Reference, Type, Status and Amount.

One request feeds the whole page: `GET /account/transactions?page&size`. Its `reports` object is
`{ allTime: Totals, weekly: Period[], monthly: Period[] }`, where
`Totals = { deposits, withdrawals, rewards, profit }` and `Period = Totals + periodStart`. One SQL statement builds
all three with `GROUPING SETS ((), (week), (month))` over `occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh'`. Weeks start
on Monday through ISO `date_trunc`. Changing the period does not refetch.

The page has no chart.

### Gaps and bugs found

| # | Where | Finding | Severity |
|---|---|---|---|
| G1 | `account.ts` `reportRows` | On an empty account, **All time** still renders one row of `0`s, and `@empty` never fires. Per the module rule, a value that was never measured should show as `—` or an empty message. Fix: return `[]` for `allTime` when `meta.totalElements === 0`. | Bug, small |
| G2 | API `list` SQL | `weekly` and `monthly` are **sparse**: a period with no transactions is missing, not zero. The table hides this. A chart on a category axis would squash time. The docs do not say this. | Gap; must handle for charts |
| G3 | API `list` SQL | `weekly` and `monthly` are **newest first** (`ORDER BY week DESC`). Charts need oldest first. The API docs do not state the order. | Doc gap |
| G4 | API `list` | The query already computes `count(*)` for each period, then drops it except for `meta.totalElements`. The client never sees how many transactions a period holds. | Gap (P2-4) |
| G5 | Reports | **Cancelled** transactions are listed but appear in no report, so a cancelled withdrawal is invisible in the totals. The domain intends this exclusion, but the user cannot see it. | Gap (P2-4) |
| G6 | `weekly`/`monthly` | Both arrays are unbounded and grow by 52 or 12 rows a year. They are aggregates, so this is acceptable for now. A weekly table that grows without limit makes a long panel. | Ceiling (P3-6) |
| G7 | `account.ts` template | Amounts use `number:'1.0-8'`, but the column is `NUMERIC(20,4)`. Use `'1.0-4'`. Status shows the raw enum (`SUCCESS`). `periodStart` shows as a raw ISO date. | Polish |
| G8 | `AccountTransactionsIT` | No test asserts that `REWARD` and `CANCELLED` rows stay out of `deposits`/`withdrawals`/`profit`. | Test gap |

## 2. Proposals

The P1 items reuse the current `reports` payload unchanged. They need **no API, model, docs-contract or sample
change**, except one clarifying sentence in `API_DOCUMENTATION.md`; see P1-2.

---

### P1-1: All-time KPI tiles (and fix G1)

**Question answered:** "Where do I stand overall? How much have I paid in, taken out, and earned in bonuses?"

**Data:** `reports.allTime` and `meta.totalElements`. **The current response already has all of it.**

**What to build:** add a `.kpis` row at the top of the Cash flow panel, under the page note. The row shows all-time
figures whatever period is selected.

| Tile | Value | Sub-text |
|---|---|---|
| Deposited | `allTime.deposits` | `successful deposits` |
| Withdrawn | `allTime.withdrawals` | `successful withdrawals` |
| Profit / loss | `allTime.profit`, with `.win`/`.loss` | `withdrawals − deposits` |
| Bonuses | `allTime.rewards` | `tracked separately` |
| Net incl. bonuses | `allTime.profit + allTime.rewards` | `profit + bonuses` |

When `meta.totalElements === 0`, every tile shows `—`. Also fix G1: `reportRows()` returns `[]` for `allTime` when
`meta.totalElements === 0`, so the existing `@empty` row shows "No transactions in this report."

Sketch:

```ts
readonly hasData = computed(() => (this.data()?.meta.totalElements ?? 0) > 0);
readonly kpis = computed(() => {
  const t = this.data()?.reports.allTime;
  if (!t || !this.hasData()) return null;          // template prints '—' for every tile
  return { ...t, net: Number(t.profit) + Number(t.rewards) };  // display-only sum
});
```

```html
<section class="kpis" aria-label="All-time account totals">
  <div class="kpi"><span>Deposited</span><strong>{{ money(kpis()?.deposits) }}</strong><span class="kpi-sub">successful deposits</span></div>
  ...
  <div class="kpi"><span>Profit / loss</span><strong [class.win]="(kpis()?.profit ?? 0) > 0" [class.loss]="(kpis()?.profit ?? 0) < 0">{{ money(kpis()?.profit) }}</strong>...</div>
</section>
```

`money(v)` is a one-line local helper: `v == null ? '—' : this.decimal.transform(v, '1.0-4')`. Alternatively, use the
template form `kpis() ? (kpis()!.deposits | number:'1.0-4') : '—'`. Do not add a new shared formatter.

**Reuse:** the `.kpis`, `.kpi`, `.kpi-sub`, `.win` and `.loss` global styles from `styles.scss`, which `reports.ts`
already uses for the same purpose. Also reuse `DecimalPipe`, which the page already imports.

**Tests (web, `account.spec.ts`):**
- With the existing fixture (`deposits 100, withdrawals 80, rewards 5, profit -20`), the KPI section contains `100`,
  `80`, `-20` and `5`. The Net tile contains `-15`. The Profit tile has class `loss`.
- On an empty ledger (the second spec's fixture, `totalElements: 0`), every `.kpi strong` reads `—`. **All time**
  shows "No transactions in this report.", which covers G1.

**API tests:** none needed. Optionally close G8 in `AccountTransactionsIT`: add one `REWARD` row and one `CANCELLED`
`DEBIT` row to the payload, then assert that `allTime.profit` does not change and `allTime.rewards` equals the reward.

---

### P1-2: Cash flow by period chart (deposits vs withdrawals bars, profit line)

**Question answered:** "In which weeks or months did I put money in or take it out? Was each period up or down?"

**Data:** `reports.weekly` or `reports.monthly`. **The current response already has them.** Handle G2 and G3 on the
client:

- Sort oldest first: `[...rows].reverse()`.
- Fill missing periods with real zeros. A period with no transactions truly had 0 deposits, so this is a measured
  zero, not a missing value.
- Keep the last N periods: 26 weeks or 24 months.

Add one pure helper in `account.ts`; do not create a new file:

```ts
/** Oldest-first periods, gaps filled with zero totals, newest `limit` kept. `rows` is the API's newest-first array. */
export function periodSeries(rows: AccountPeriod[], step: 'week' | 'month', limit: number): AccountPeriod[] {
  if (!rows.length) return [];
  const byStart = new Map(rows.map(r => [r.periodStart, r]));
  const zero = { deposits: 0, withdrawals: 0, rewards: 0, profit: 0 };
  const out: AccountPeriod[] = [];
  const d = new Date(rows.at(-1)!.periodStart + 'T00:00:00Z');
  const end = rows[0].periodStart;
  for (let key = rows.at(-1)!.periodStart; key <= end; ) {
    out.push(byStart.get(key) ?? { periodStart: key, ...zero });
    step === 'week' ? d.setUTCDate(d.getUTCDate() + 7) : d.setUTCMonth(d.getUTCMonth() + 1);
    key = d.toISOString().slice(0, 10);
  }
  return out.slice(-limit);
  // ponytail: the client caps the window to 26 weeks / 24 months; move the cap into SQL (P3-6) if history gets long.
}
```

`periodStart` is always a Monday or the 1st of a month, both in GMT+7 calendar terms. Stepping in UTC on a
date-only value is therefore exact, with no DST issue, because Vietnam has no DST and the values are plain dates.

The chart follows the toggle. **Weekly** uses `weekly`, step `'week'`, limit 26. **Monthly** and **All time** use
`monthly`, step `'month'`, limit 24.

```ts
readonly chartPeriod = computed(() => this.period() === 'weekly' ? 'weekly' : 'monthly');
readonly series = computed(() => {
  const r = this.data()?.reports;
  if (!r) return [];
  const weekly = this.chartPeriod() === 'weekly';
  return periodSeries(weekly ? r.weekly : r.monthly, weekly ? 'week' : 'month', weekly ? 26 : 24);
});
readonly flowChart = computed(() => {
  const rows = this.series();
  return {
    labels: rows.map(r => r.periodStart),
    datasets: [
      { type: 'bar' as const, label: 'Deposits', data: rows.map(r => Number(r.deposits)), backgroundColor: () => SERIES[1], borderRadius: 4, order: 2 },
      { type: 'bar' as const, label: 'Withdrawals', data: rows.map(r => Number(r.withdrawals)), backgroundColor: () => SERIES[0], borderRadius: 4, order: 2 },
      { type: 'line' as const, label: 'Profit / loss', data: rows.map(r => Number(r.profit)), borderColor: () => SERIES[2],
        backgroundColor: () => SERIES[2], tension: .2, pointRadius: rows.length < 3 ? 5 : 2, order: 1 },
    ],
  };
});
readonly flowOptions: ChartOptions = {
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
  scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
};
```

Use `<mm-chart type="bar">` with per-dataset `type` for the mixed bar-and-line chart. Chart.js supports this natively.
Colour every dataset through a **function** (`() => SERIES[i]`) so that a light/dark switch recolours the chart, as
`shared/chart.ts` documents and `dashboard.spec.ts` (DASH-1) checks. Do not use `RESULT_COLORS` win/loss colours for
the bars: deposits are not losses.

**Placement:** in the Cash flow panel, between the KPI tiles and the table. Use `<div class="dash-grid">` with
`<section class="span-4">` for this chart and `<section class="span-2">` for P1-3, so the panel stays full width. The
existing responsive rules in `styles.scss` stack both sections at ≤1100px and ≤760px. Give the chart a heading such
as `<h3>Cash flow per {{ chartPeriod() === 'weekly' ? 'week' : 'month' }}</h3>`. When `series()` is empty, show the
dashboard's empty state: `<div class="empty-state"><i class="pi pi-chart-bar"></i><span>No transactions yet.</span></div>`.

**Docs:** one sentence for the Account Management section of `API_DOCUMENTATION.md`: "`weekly` and `monthly` are
newest first and omit periods without transactions." This documents behaviour that already exists, so `models.ts` and
the samples do not change.

**Reuse:** `ChartView`, `SERIES` and the `.empty-state` and `.dash-grid`/`.span-*` styles. The pattern matches the
dashboard's `unitsChart`/`byMarketChart`.

**Tests (web, `account.spec.ts`):**
- `periodSeries` as a plain unit test:
  - Weekly input `[{periodStart:'2026-11-16',…}, {periodStart:'2026-11-02',…}]` returns 3 rows, oldest first. The
    `'2026-11-09'` row is all zeros.
  - Monthly input that spans a year boundary (`2027-01-01` and `2026-11-01`) fills `2026-12-01`.
  - `limit` keeps only the newest N.
  - Empty input returns `[]`.
- Component test:
  - After clicking `[data-period="weekly"]`, `flowChart().labels` is oldest first and `mm-chart` is rendered.
  - `(flowChart().datasets[0].backgroundColor as () => string)()` equals `SERIES[1]`.
  - On an empty ledger, no `mm-chart` renders and the empty state shows.

**API tests:** none. The payload does not change.

---

### P1-3: Cumulative profit line (running position)

**Question answered:** "How has my overall position moved over time? Am I trending up or down?"

**Data:** the same `series()` as P1-2 plus `allTime.profit`. **The current response already has them.** The window
holds only the last 24 or 26 periods, so start the running total at the profit made **before** the window. The line
then always ends exactly at the all-time profit:

```ts
readonly cumulativeChart = computed(() => {
  const rows = this.series();
  const all = Number(this.data()?.reports.allTime.profit ?? 0);
  let total = all - rows.reduce((s, r) => s + Number(r.profit), 0);   // profit before the window
  const data = rows.map(r => (total += Number(r.profit)));
  return {
    labels: rows.map(r => r.periodStart),
    datasets: [{ label: 'Cumulative profit / loss', data, borderColor: () => SERIES[0], backgroundColor: () => SERIES[0] + '1f',
      fill: 'origin', tension: .2, pointRadius: rows.length < 3 ? 5 : 2 }],
  };
});
```

These are display-only float sums of 4-decimal values. Format tooltip and tick labels with `toFixed(4)` or the
`DecimalPipe`, so values like `0.30000000004` never show. The server remains the source of truth for money, so no
`BigDecimal` rule is affected.

**Chart:** `<mm-chart type="line">`, an area to the origin. This is the dashboard's `unitsChart` pattern
(`dashboard.ts`, "Cumulative units").

**Placement:** the `span-2` section next to P1-2, inside the same `.dash-grid`, with heading
`<h3>Running profit / loss</h3>`. Show the same empty state when `series()` is empty.

**Reuse:** `ChartView`, `SERIES`, and the `unitsChart` and `unitsOptions` shape from `dashboard.ts`, with
`legend: { display: false }`.

**Tests (web):**
- Weekly fixture with `allTime.profit = -20` and weeks `[{2026-11-16, profit 30}, {2026-11-02, profit -80}]` (the
  gap at `2026-11-09` is filled). The data is `[-50, -50, -20]`: the start offset is `-20 − (-50) = 30`, so the first
  point is `30 + (-80) = -50`. The last point equals `allTime.profit` (`toBeCloseTo`).
- The colour function returns `SERIES[0]`.

---

### P2-4: Per-period counts and cancelled withdrawals (closes G4 and G5)

**Question answered:** "How many deposits and withdrawals did I make, and how large were they on average? How much of
my withdrawal requests were cancelled?"

**Data:** **this needs a SQL change.** The data stays in the same statement and on the same endpoint, but the
contract grows. Add four aggregates to the existing `SELECT` in `AccountTransactions.list`:

```sql
count(*) FILTER (WHERE type='CREDIT' AND status='SUCCESS')                     AS deposit_count,
count(*) FILTER (WHERE type='DEBIT'  AND status='SUCCESS')                     AS withdrawal_count,
count(*) FILTER (WHERE type='DEBIT'  AND status='CANCELLED')                   AS cancelled_withdrawal_count,
coalesce(sum(amount) FILTER (WHERE type='DEBIT' AND status='CANCELLED'),0)     AS cancelled_withdrawals
```

Extend `Summary` to
`Summary(BigDecimal deposits, BigDecimal withdrawals, BigDecimal rewards, long depositCount, long withdrawalCount, long cancelledWithdrawalCount, BigDecimal cancelledWithdrawals)`.
`profit()` stays as it is. Each `Period` and `allTime` gains:

```json
{ "periodStart": "2026-11-16", "deposits": 100, "withdrawals": 80, "rewards": 5, "profit": -20,
  "depositCount": 2, "withdrawalCount": 1, "cancelledWithdrawalCount": 1, "cancelledWithdrawals": 80 }
```

**UI:** add the columns "Deposits #", "Withdrawals #" and "Cancelled withdrawals" to the existing Cash flow table.
Add one KPI tile, "Cancelled withdrawals", with sub-text `N requests`. Compute the average size on the client:
`deposits / depositCount`. Show `—` when the count is 0. No new chart.

**Contract:** change `API_DOCUMENTATION.md`, the `AccountTotals` interface in `core/models.ts` and a new sample
`docs/samples/account-transactions.json` together.

**Tests:**
- IT (`AccountTransactionsIT`): add one `CANCELLED` `DEBIT` row. Assert `/reports/allTime/cancelledWithdrawals`,
  `/reports/allTime/withdrawalCount` and the weekly counts. Assert that `profit` does not change.
- Web: the table renders the counts. A period with `depositCount: 0` shows `—` for the average.

---

### P2-5: This month vs last month (KPI sub-text)

**Question answered:** "How am I doing this month compared with last month?"

**Data:** `monthly` from the current response, through `periodSeries(monthly, 'month', 2)`. That call gives the last
two calendar months, gaps filled. Compare the newest `periodStart` with the current GMT+7 month, computed as
`new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date()) + '-01'`.
If they differ, the current month had no transactions, so this month is 0 and last month is the newest row.

**UI:** add one more KPI tile, "This month" (profit, `.win`/`.loss`), with sub-text `last month ±X`. No chart and no
API change.

**Tests (web):** use a fixed clock (`vi.setSystemTime`). Cover two fixtures: the newest month is the current one, and
the newest month is older. Check the tile and sub-text values.

---

### P3-6: Date-range filter and a server-side cap on period arrays (closes G6)

**Question answered:** "Show me cash flow between two dates." It also keeps the payload small as history grows.

**Data:** **this needs a SQL change.** Add optional `from` and `to` query parameters, bound as `?`. `to` is
exclusive, as in the rest of the API. Apply them in the `periods` CTE's `WHERE` clause. Cap the weekly and monthly
rows with a window filter, for example `WHERE week >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - interval '26 weeks'`.
The cap also lets `periodSeries` drop its `limit`.

**Why P3:** the window is already capped on the client (P1-2), and today's aggregate payload is small. Build this
only when a user asks for custom ranges, or when weekly history passes a few hundred rows. Reuse
`shared/filter-bar` (`FilterBar`) for the date inputs, as `dashboard.ts` and `reports.ts` do.

**Tests:** IT for `from`/`to` bounds (exclusive `to`) and for the cap. Web: the filter changes the request params.

---

## 3. Implementation order (P1 only)

P1 needs no API or SQL change, so `matchmind-api` stays untouched. G8 is an optional extra IT assertion.

1. **`MatchMind/matchmind-web/src/app/pages/account.ts`**
   - Imports: `ChartView` and `SERIES` from `../shared/chart`, `ChartOptions` from `chart.js`, and `AccountPeriod`
     from `../core/models`. Add `ChartView` to the component's `imports`.
   - Add the exported pure function `periodSeries` at the top level of the file (P1-2).
   - Add `hasData` and `kpis` (P1-1). Fix `reportRows` for an empty ledger (G1). Add `chartPeriod`, `series`,
     `flowChart` and `flowOptions` (P1-2). Add `cumulativeChart` and `cumulativeOptions` (P1-3).
   - Template, inside the Cash flow panel and in this order: note, period toggle, `.kpis` row, `.dash-grid` (span-4
     flow chart, span-2 cumulative chart, each with an `.empty-state` fallback), then the existing table.
   - Optional polish (G7): change `number:'1.0-8'` to `number:'1.0-4'`.
2. **`MatchMind/matchmind-web/src/app/pages/account.spec.ts`**
   - Add `periodSeries` unit cases: gap fill, year boundary, limit and empty input.
   - Extend the existing ledger spec to cover the KPI values, the `loss` class and the net tile.
   - Add an empty-ledger spec: tiles show `—`, All time shows the `@empty` row, no `mm-chart` renders.
   - Add a chart spec: weekly labels are oldest first, the colour functions return `SERIES[i]`, and the cumulative
     last point equals `allTime.profit`.
3. **`MatchMind/docs/API_DOCUMENTATION.md`**: add one sentence to the Account Management section saying that
   `weekly`/`monthly` are newest first and omit empty periods (G2, G3). This documents existing behaviour, so
   `models.ts` and the samples do not change.
4. *(Optional, G8)* **`MatchMind/matchmind-api/src/test/java/com/matchmind/it/AccountTransactionsIT.java`**: add one
   `REWARD` and one `CANCELLED` `DEBIT` row and assert that `profit` does not change.

Verify with the commands in `MatchMind/AGENTS.override.md`. For the web, run `npx ng test --watch=false && npx ng build`
in `matchmind-web`. For the API, run `mvn -B verify` only if step 4 is done.
