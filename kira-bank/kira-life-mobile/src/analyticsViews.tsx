import React, {useState} from 'react';
import {Pressable, Share, View} from 'react-native';
import {
  AccountsReport, ActivityReport, BonusReport, CadenceReport, ComparisonReport, DailyReport, DistributionReport, DrawdownReport,
  AllocationReport, EquityReport, GoalsReport, LotsReport, InsightsReport, PerformanceReport, LedgerReport, MatrixReport, OverviewReport, PaybackReport, PeriodicReport, ProjectionReport, RollingReport,
  SeasonalityReport
} from './investmentApi';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {dateLabel} from './data';
import {bucketSum, downsample, parseAmount, ReportCtx, SignedBars, Stat, Stats, toCsv, TotalsStats} from './analyticsParts';
import {Button, Card, Chips, Field, Row, T} from './ui';

const netColor = (c: ReturnType<typeof useTheme>['colors'], value: number) => value < 0 ? c.error : c.success;

export function PeriodicView({data, ctx}: { data: PeriodicReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const [shown, setShown] = useState(40);
  const rows = data.rows;
  const bars = bucketSum(rows.map(row => ({key: row.period, value: row.totals.net})), 80);
  return <Card>
    <T size={13} bold>{t('Lãi/lỗ theo kỳ')}</T>
    <TotalsStats totals={data.totals} ctx={ctx}/>
    <Stats>
      <Stat label={t('Lãi/lỗ trung bình / kỳ')} value={ctx.fmt(data.averageNet)}/>
      <Stat label={t('Số giao dịch')} value={String(data.totals.count)}/>
      <Stat label={t('Kỳ có lãi')} value={String(data.profitablePeriods)}/>
      <Stat label={t('Kỳ thua lỗ')} value={String(data.losingPeriods)}/>
      {data.best ? <Stat label={t('Kỳ tốt nhất')} value={`${data.best.period} · ${ctx.fmt(data.best.totals.net)}`}/> : null}
      {data.worst ? <Stat label={t('Kỳ tệ nhất')} value={`${data.worst.period} · ${ctx.fmt(data.worst.totals.net)}`}/> : null}
    </Stats>
    <Button label={t('Chia sẻ CSV')} kind="secondary" onPress={() => Share.share({message: toCsv(['period', 'transactions', 'deposits', 'withdrawals', 'bonuses', 'net', 'cumulative_net', 'currency'],
      rows.map(r => [r.period, r.totals.count, r.totals.deposits, r.totals.withdrawals, r.totals.bonuses, r.totals.net, r.cumulativeNet, ctx.currency]))})}/>
    <SignedBars items={bars.map(bar => ({key: bar.key, value: bar.value, label: `${bar.key} · ${ctx.fmt(bar.value)}`}))}/>
    <Row><T size={9} color={c.muted}>{rows[0]?.period}</T><View style={{flex: 1}}/><T size={9} color={c.muted}>{rows[rows.length - 1]?.period}</T></Row>
    {[...rows].reverse().slice(0, shown).map(row => <View key={row.period} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 6}}>
      <Row><T size={12} bold style={{flex: 1}}>{row.period}</T>
        <T size={12} bold color={netColor(c, row.totals.net)}>{ctx.fmt(row.totals.net)}</T></Row>
      <T size={10} color={c.muted}>{t('Nạp')} {ctx.fmt(row.totals.deposits)} · {t('Rút')} {ctx.fmt(row.totals.withdrawals)} · {t('Thưởng')} {ctx.fmt(row.totals.bonuses)}</T>
      <T size={10} color={c.muted}>{t('Lũy kế')} {ctx.fmt(row.cumulativeNet)}{row.netChangePct != null ? ` · ${row.netChangePct}%` : ''}</T>
    </View>)}
    {rows.length > shown ? <Button label={t('Xem thêm')} kind="secondary" onPress={() => setShown(shown + 40)}/> : null}
  </Card>;
}

export function AccountsView({data, ctx, onSelect}: { data: AccountsReport; ctx: ReportCtx; onSelect: (accountId: number) => void }) {
  const t = useT();
  const {colors: c} = useTheme();
  return <Card>
    <T size={13} bold>{t('Xếp hạng tài khoản')}</T>
    <TotalsStats totals={data.totals} ctx={ctx}/>
    {data.rows.map((row, index) => <View key={row.accountId} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 8, gap: 2}}>
      <Row><Pressable accessibilityRole="button" accessibilityLabel={`${t('Tổng quan')}: ${row.accountName}`} onPress={() => onSelect(row.accountId)} style={{flex: 1}}>
        <T size={12} bold color={c.primary}>{index + 1}. {row.accountName}</T></Pressable>
        <T size={12} bold color={netColor(c, row.totals.net)}>{ctx.fmt(row.totals.net)}</T></Row>
      <T size={10} color={c.muted}>{t('Nạp')} {ctx.fmt(row.totals.deposits)} · {t('Rút')} {ctx.fmt(row.totals.withdrawals)} · {t('Thưởng')} {ctx.fmt(row.totals.bonuses)}</T>
      <T size={10} color={c.muted}>ROI {row.roiPct == null ? '—' : `${row.roiPct}%`} · {t('Tỷ trọng')} {row.netSharePct == null ? '—' : `${row.netSharePct}%`} · {t('Số giao dịch')} {row.totals.count}</T>
      <T size={10} color={c.muted}>{t('Nạp TB')} {ctx.fmt(row.averageDeposit)} · {t('Rút TB')} {ctx.fmt(row.averageWithdrawal)}</T>
      <T size={10} color={c.muted}>{t('Hoạt động gần nhất')}: {dateLabel(row.lastDate)} · {t('{{n}} ngày trước', {n: row.daysSinceLast})}</T>
    </View>)}
  </Card>;
}

export function EquityView({data, ctx}: { data: EquityReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const decided = data.winDays + data.lossDays;
  const points = downsample(data.points);
  return <Card>
    <T size={13} bold>{t('Đường vốn & sụt giảm')}</T>
    <Stats>
      <Stat label={t('Lãi/lỗ cuối kỳ')} value={ctx.fmt(data.finalNet)} color={netColor(c, data.finalNet)}/>
      <Stat label={t('Đỉnh lãi/lỗ')} value={ctx.fmt(data.peakNet)}/>
      <Stat label={t('Sụt giảm tối đa')} value={`${ctx.fmt(data.maxDrawdown)}${data.maxDrawdownDate ? ` · ${dateLabel(data.maxDrawdownDate)}` : ''}`} color={c.error}/>
      <Stat label={t('Sụt giảm hiện tại')} value={ctx.fmt(data.currentDrawdown)}/>
      <Stat label={t('Ngày có giao dịch')} value={String(data.activeDays)}/>
      <Stat label={t('Tỷ lệ ngày thắng')} value={decided ? `${(data.winDays / decided * 100).toFixed(1)}%` : '—'}/>
      <Stat label={t('Ngày có lãi')} value={String(data.winDays)}/>
      <Stat label={t('Ngày thua lỗ')} value={String(data.lossDays)}/>
      <Stat label={t('Chuỗi thắng dài nhất')} value={String(data.longestWinStreak)}/>
      <Stat label={t('Chuỗi thua dài nhất')} value={String(data.longestLossStreak)}/>
      <Stat label={t('Chuỗi hiện tại (+thắng / −thua)')} value={String(data.currentStreak)}/>
      {data.bestDay ? <Stat label={t('Ngày tốt nhất')} value={`${dateLabel(data.bestDay.date)} · ${ctx.fmt(data.bestDay.net)}`} color={c.success}/> : null}
      {data.worstDay ? <Stat label={t('Ngày tệ nhất')} value={`${dateLabel(data.worstDay.date)} · ${ctx.fmt(data.worstDay.net)}`} color={c.error}/> : null}
    </Stats>
    <T size={11} bold>{t('Lãi/lỗ lũy kế')}</T>
    <SignedBars items={points.map(p => ({key: p.date, value: p.cumulativeNet, label: `${dateLabel(p.date)} · ${ctx.fmt(p.cumulativeNet)}`}))}/>
    <T size={11} bold>{t('Sụt giảm so với đỉnh')}</T>
    <SignedBars height={60} items={points.map(p => ({key: p.date, value: -p.drawdown, label: `${dateLabel(p.date)} · ${ctx.fmt(p.drawdown)}`}))}/>
    <Row><T size={9} color={c.muted}>{dateLabel(points[0]?.date ?? '')}</T><View style={{flex: 1}}/><T size={9} color={c.muted}>{dateLabel(points[points.length - 1]?.date ?? '')}</T></Row>
  </Card>;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function ActivityView({data, ctx}: { data: ActivityReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const max = Math.max(1, ...data.matrix.flat());
  return <Card>
    <T size={13} bold>{t('Quy luật giao dịch')}</T>
    <Stats>
      <Stat label={t('Thứ giao dịch nhiều nhất')} value={t(WEEKDAYS[data.busiestWeekday - 1])}/>
      <Stat label={t('Giờ giao dịch nhiều nhất')} value={`${data.busiestHour}:00`}/>
      <Stat label={t('Ngày trong tháng nhiều giao dịch nhất')} value={String(data.busiestDayOfMonth)}/>
    </Stats>
    <T size={11} bold>{t('Giao dịch theo thứ và giờ')}</T>
    {data.matrix.map((row, d) => <View key={d} style={{flexDirection: 'row', alignItems: 'center', gap: 1}}>
      <T size={9} color={c.muted} style={{width: 22}}>{t(WEEKDAYS[d])}</T>
      {row.map((count, h) => <View key={h} accessibilityLabel={`${t(WEEKDAYS[d])} ${h}:00 · ${count}`}
        style={{flex: 1, height: 18, borderRadius: 2, backgroundColor: count ? c.primary : c.border, opacity: count ? 0.25 + 0.75 * count / max : 0.5}}/>)}
    </View>)}
    <Row><View style={{width: 22}}/><T size={9} color={c.muted}>0h</T><View style={{flex: 1}}/><T size={9} color={c.muted}>12h</T><View style={{flex: 1}}/><T size={9} color={c.muted}>23h</T></Row>
    <T size={11} bold>{t('Lãi/lỗ theo ngày trong tháng')}</T>
    <SignedBars height={60} items={data.byDayOfMonth.map(slot => ({key: String(slot.key), value: slot.totals.net, label: `${slot.key} · ${slot.totals.count} · ${ctx.fmt(slot.totals.net)}`}))}/>
    <Row><T size={9} color={c.muted}>1</T><View style={{flex: 1}}/><T size={9} color={c.muted}>15</T><View style={{flex: 1}}/><T size={9} color={c.muted}>31</T></Row>
    <T size={11} bold>{t('Theo thứ trong tuần')}</T>
    {data.byWeekday.map(slot => <Row key={slot.key}>
      <T size={11} style={{width: 28}}>{t(WEEKDAYS[slot.key - 1])}</T>
      <T size={10} color={c.muted} style={{flex: 1}}>{slot.totals.count} · {ctx.fmt(slot.totals.deposits)} / {ctx.fmt(slot.totals.withdrawals)}</T>
      <T size={11} bold color={netColor(c, slot.totals.net)}>{ctx.fmt(slot.totals.net)}</T>
    </Row>)}
  </Card>;
}

const TYPE_LABEL: Record<string, string> = {DEPOSIT: 'Nạp', WITHDRAWAL: 'Rút', BONUS: 'Thưởng'};

export function DistributionView({data, ctx}: { data: DistributionReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const max = Math.max(1, ...data.buckets.flatMap(b => [b.deposits, b.withdrawals, b.bonuses]));
  const bar = (count: number, color: string) => <View style={{flex: 1, height: `${count / max * 100}%`, backgroundColor: color, borderTopLeftRadius: 2, borderTopRightRadius: 2}}/>;
  return <Card>
    <T size={13} bold>{t('Quy mô giao dịch')}</T>
    {data.byType.map(row => <View key={row.type} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 2}}>
      <Row><T size={12} bold style={{flex: 1}}>{t(TYPE_LABEL[row.type] ?? row.type)}</T><T size={11}>{row.count} · {ctx.fmt(row.total)}</T></Row>
      <T size={10} color={c.muted}>Min {ctx.fmt(row.min)} · Max {ctx.fmt(row.max)}</T>
      <T size={10} color={c.muted}>{t('Trung bình')} {ctx.fmt(row.average)} · {t('Trung vị')} {ctx.fmt(row.median)} · P90 {ctx.fmt(row.p90)}</T>
    </View>)}
    <T size={11} bold>{t('Biểu đồ quy mô giao dịch')}</T>
    <View style={{flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 4, borderBottomWidth: 1, borderColor: c.border}}>
      {data.buckets.map((b, i) => <View key={i} accessibilityLabel={`${ctx.fmt(b.from)} – ${ctx.fmt(b.to)} · ${b.deposits + b.withdrawals + b.bonuses}`}
        style={{flex: 1, height: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 1}}>{bar(b.deposits, c.primary)}{bar(b.withdrawals, c.warning)}{bar(b.bonuses, c.success)}</View>)}
    </View>
    <Row><T size={9} color={c.muted}>{ctx.fmt(data.buckets[0]?.from ?? 0)}</T><View style={{flex: 1}}/><T size={9} color={c.muted}>{ctx.fmt(data.buckets[data.buckets.length - 1]?.to ?? 0)}</T></Row>
    <T size={11} bold>{t('Top 10 giao dịch lớn nhất')}</T>
    {data.largest.map((row, i) => <Row key={i}>
      <View style={{flex: 1}}><T size={11}>{row.accountName}</T><T size={9} color={c.muted}>{t(TYPE_LABEL[row.type] ?? row.type)} · {dateLabel(row.at.slice(0, 16))}</T></View>
      <T size={11} bold>{ctx.fmt(row.amount)}</T>
    </Row>)}
  </Card>;
}

const METRICS: Record<string, string> = {COUNT: 'Số giao dịch', DEPOSITS: 'Nạp', WITHDRAWALS: 'Rút', BONUSES: 'Thưởng', NET: 'Lãi/lỗ', NET_WITH_BONUS: 'Lãi/lỗ + thưởng'};

export function ComparisonView({data, ctx}: { data: ComparisonReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const fmt = (metric: string, value: number) => metric === 'COUNT' ? String(value) : ctx.fmt(value);
  return <Card>
    <T size={13} bold>{t('So sánh kỳ')}</T>
    <T size={10} color={c.muted}>{t('Kỳ trước')}: {dateLabel(data.previousFrom)} → {dateLabel(data.previousTo)}</T>
    {data.deltas.map(d => <View key={d.metric} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 2}}>
      <Row><T size={12} bold style={{flex: 1}}>{t(METRICS[d.metric] ?? d.metric)}</T>
        <T size={12} bold color={d.change === 0 ? c.muted : netColor(c, d.change)}>{d.change > 0 ? '+' : ''}{fmt(d.metric, d.change)}{d.changePct != null ? ` (${d.changePct}%)` : ''}</T></Row>
      <T size={10} color={c.muted}>{t('Kỳ đã chọn')} {fmt(d.metric, d.current)} · {t('Kỳ trước')} {fmt(d.metric, d.previous)}</T>
    </View>)}
  </Card>;
}

export function DailyView({data, ctx, fromDate, toDate}: { data: DailyReport; ctx: ReportCtx; fromDate: string; toDate: string }) {
  const t = useT();
  const {colors: c} = useTheme();
  const byDate = new Map(data.days.map(day => [day.date, day]));
  const maxAbs = Math.max(1, ...data.days.map(day => Math.abs(day.totals.net)));
  const months: { label: string; cells: (null | { day: number; net: number | null; count: number })[] }[] = [];
  const end = new Date(`${toDate}T00:00:00Z`);
  for (let cursor = new Date(`${fromDate.slice(0, 7)}-01T00:00:00Z`); cursor <= end;
       cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells: (null | { day: number; net: number | null; count: number })[] = Array((new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7).fill(null);
    for (let day = 1; day <= last; day++) {
      const row = byDate.get(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      cells.push({day, net: row ? row.totals.net : null, count: row?.totals.count ?? 0});
    }
    while (cells.length % 7) cells.push(null);
    months.push({label: `${year}-${String(month + 1).padStart(2, '0')}`, cells});
  }
  return <Card>
    <T size={13} bold>{t('Lịch theo ngày')}</T>
    <Stats>
      <Stat label={t('Lãi/lỗ')} value={ctx.fmt(data.totals.net)} color={netColor(c, data.totals.net)}/>
      <Stat label={t('Ngày có giao dịch')} value={String(data.days.length)}/>
      <Stat label={t('Lãi/lỗ TB / ngày hoạt động')} value={ctx.fmt(data.averageNetPerActiveDay)}/>
      <Stat label={t('Giao dịch TB / ngày hoạt động')} value={String(data.averageTransactionsPerActiveDay)}/>
      {data.best ? <Stat label={t('Ngày tốt nhất')} value={`${dateLabel(data.best.date)} · ${ctx.fmt(data.best.totals.net)}`} color={c.success}/> : null}
      {data.worst ? <Stat label={t('Ngày tệ nhất')} value={`${dateLabel(data.worst.date)} · ${ctx.fmt(data.worst.totals.net)}`} color={c.error}/> : null}
    </Stats>
    {[{title: 'Top 5 ngày tốt nhất', rows: [...data.days].filter(d => d.totals.net > 0).sort((a, b) => b.totals.net - a.totals.net).slice(0, 5)},
      {title: 'Top 5 ngày tệ nhất', rows: [...data.days].filter(d => d.totals.net < 0).sort((a, b) => a.totals.net - b.totals.net).slice(0, 5)}]
      .filter(group => group.rows.length > 0).map(group => <View key={group.title} style={{gap: 2}}>
        <T size={11} bold>{t(group.title)}</T>
        {group.rows.map(d => <Row key={d.date}><T size={11} style={{flex: 1}}>{dateLabel(d.date)}</T>
          <T size={11} bold color={netColor(c, d.totals.net)}>{ctx.fmt(d.totals.net)}</T></Row>)}
      </View>)}
    {months.map(month => <View key={month.label} style={{gap: 2}}>
      <T size={11} bold>{month.label}</T>
      <View style={{flexDirection: 'row'}}>{WEEKDAYS.map(d => <T key={d} size={9} color={c.muted} style={{flex: 1, textAlign: 'center'}}>{t(d)}</T>)}</View>
      {Array.from({length: month.cells.length / 7}, (_, w) => <View key={w} style={{flexDirection: 'row', gap: 2}}>
        {month.cells.slice(w * 7, w * 7 + 7).map((cell, i) => <View key={i}
          accessibilityLabel={cell && cell.net != null ? `${month.label}-${String(cell.day).padStart(2, '0')} · ${ctx.fmt(cell.net)}` : undefined}
          style={{flex: 1, height: 30, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: cell ? 1 : 0, borderColor: c.border,
            backgroundColor: cell && cell.net ? (cell.net > 0 ? c.success : c.error) : 'transparent',
            opacity: cell && cell.net ? 0.3 + 0.7 * Math.abs(cell.net) / maxAbs : 1}}>
          {cell ? <T size={9} color={cell.net ? c.ink : c.muted}>{cell.day}</T> : null}</View>)}
      </View>)}
    </View>)}
  </Card>;
}

export function RollingView({data, ctx}: { data: RollingReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const points = downsample(data.points);
  return <Card>
    <T size={13} bold>{t('Cuốn chiếu & biến động')}</T>
    <Stats>
      <Stat label={t('7 ngày gần nhất')} value={ctx.fmt(data.latest7)} color={netColor(c, data.latest7)}/>
      <Stat label={t('30 ngày gần nhất')} value={ctx.fmt(data.latest30)} color={netColor(c, data.latest30)}/>
      {data.best7 != null ? <Stat label={t('Cửa sổ 7 ngày tốt nhất')} value={ctx.fmt(data.best7)}/> : null}
      {data.worst7 != null ? <Stat label={t('Cửa sổ 7 ngày tệ nhất')} value={ctx.fmt(data.worst7)}/> : null}
      <Stat label={t('Lãi/lỗ TB mỗi ngày')} value={ctx.fmt(data.averageDailyNet)}/>
      <Stat label={t('Biến động (σ theo ngày)')} value={ctx.fmt(data.volatility)}/>
    </Stats>
    <T size={10} color={c.muted}>{t('Biến động là độ lệch chuẩn mẫu của lãi/lỗ theo ngày trên mọi ngày trong khoảng, kể cả ngày không giao dịch.')}</T>
    <T size={11} bold>{t('Cuốn chiếu 7 ngày')}</T>
    <SignedBars items={points.map(p => ({key: p.date, value: p.rolling7, label: `${dateLabel(p.date)} · ${ctx.fmt(p.rolling7)}`}))} height={70}/>
    <T size={11} bold>{t('Cuốn chiếu 30 ngày')}</T>
    <SignedBars items={points.map(p => ({key: p.date, value: p.rolling30, label: `${dateLabel(p.date)} · ${ctx.fmt(p.rolling30)}`}))} height={70}/>
    <Row><T size={9} color={c.muted}>{dateLabel(points[0]?.date ?? '')}</T><View style={{flex: 1}}/><T size={9} color={c.muted}>{dateLabel(points[points.length - 1]?.date ?? '')}</T></Row>
  </Card>;
}

export function BonusView({data, ctx}: { data: BonusReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const pct = (value: number | null) => value == null ? '—' : `${value}%`;
  const rows = (title: string, items: BonusReport['byMonth']) => <View style={{gap: 4}}>
    <T size={11} bold>{title}</T>
    {items.map(row => <View key={row.key} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 4}}>
      <Row><T size={11} style={{flex: 1}}>{row.label}</T><T size={11} bold>{ctx.fmt(row.bonuses)}</T></Row>
      <T size={10} color={c.muted}>{t('Số lần thưởng')} {row.bonusCount} · {t('Nạp')} {ctx.fmt(row.deposits)} · {pct(row.bonusPctOfDeposits)}</T>
    </View>)}</View>;
  return <Card>
    <T size={13} bold>{t('Phân tích thưởng')}</T>
    <Stats>
      <Stat label={t('Thưởng')} value={ctx.fmt(data.totalBonuses)}/>
      <Stat label={t('Nạp')} value={ctx.fmt(data.totalDeposits)}/>
      <Stat label={t('Thưởng / tiền nạp')} value={pct(data.bonusPctOfDeposits)}/>
      <Stat label={t('Thưởng / (lãi/lỗ + thưởng) dương')} value={pct(data.bonusPctOfPositiveNet)}/>
      <Stat label={t('Thưởng trung bình')} value={ctx.fmt(data.averageBonus)}/>
      <Stat label={t('Thưởng lớn nhất')} value={ctx.fmt(data.largestBonus)}/>
    </Stats>
    {rows(t('Theo tháng (thưởng)'), data.byMonth)}
    {rows(t('Theo tài khoản'), data.byAccount)}
  </Card>;
}

const pct = (value: number | null) => value == null ? '—' : `${value}%`;

export function PaybackView({data, ctx}: { data: PaybackReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  return <Card>
    <T size={13} bold>{t('Hoàn vốn')}</T>
    <T size={10} color={c.muted}>{t('Chỉ tính trong khoảng ngày đã chọn. Đã thu hồi = rút ÷ nạp; còn lại = nạp − rút (âm nghĩa là có lãi).')}</T>
    <Stats>
      <Stat label={t('Nạp')} value={ctx.fmt(data.deposits)}/>
      <Stat label={t('Rút')} value={ctx.fmt(data.withdrawals)}/>
      <Stat label={t('Đã thu hồi')} value={pct(data.recoveredPct)}/>
      <Stat label={t('Còn lại')} value={ctx.fmt(data.outstanding)} color={data.outstanding > 0 ? c.error : c.success}/>
      <Stat label={t('Tài khoản đã hoàn vốn')} value={String(data.accountsBrokeEven)}/>
      <Stat label={t('Tài khoản chưa hoàn vốn')} value={String(data.accountsOutstanding)}/>
    </Stats>
    {data.rows.map(row => <View key={row.accountId} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 8, gap: 3}}>
      <Row><T size={12} bold style={{flex: 1}}>{row.accountName}</T><T size={11} bold color={row.outstanding > 0 ? c.error : c.success}>{ctx.fmt(row.outstanding)}</T></Row>
      <View style={{height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden'}}>
        <View style={{width: `${Math.min(100, Math.max(0, row.recoveredPct ?? 0))}%`, height: '100%', backgroundColor: c.primary}}/></View>
      <T size={10} color={c.muted}>{t('Đã thu hồi')} {pct(row.recoveredPct)} · {t('Nạp')} {ctx.fmt(row.deposits)} · {t('Rút')} {ctx.fmt(row.withdrawals)}</T>
      {row.breakEvenDate ? <T size={10} color={c.muted}>{t('Ngày hoàn vốn')}: {dateLabel(row.breakEvenDate)} · {t('Số ngày để hoàn vốn')}: {row.daysToBreakEven}</T> : null}
    </View>)}
  </Card>;
}

export function SeasonalityView({data, ctx}: { data: SeasonalityReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c, } = useTheme();
  const {lang} = useLanguage();
  const name = (month: number) => new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'vi-VN', {month: 'short', timeZone: 'UTC'}).format(new Date(Date.UTC(2026, month - 1, 1)));
  return <Card>
    <T size={13} bold>{t('Tính mùa vụ')}</T>
    <T size={10} color={c.muted}>{t('Lãi/lỗ trung bình theo từng tháng trong năm, qua các năm trong khoảng đã chọn. Nên chọn khoảng từ 12 tháng.')}</T>
    <Stats>
      {data.best ? <Stat label={t('Tháng tốt nhất (TB)')} value={`${name(data.best.month)} · ${ctx.fmt(data.best.averageNet)}`} color={c.success}/> : null}
      {data.worst ? <Stat label={t('Tháng tệ nhất (TB)')} value={`${name(data.worst.month)} · ${ctx.fmt(data.worst.averageNet)}`} color={c.error}/> : null}
    </Stats>
    <SignedBars items={data.months.map(m => ({key: String(m.month), value: m.averageNet, label: `${name(m.month)} · ${ctx.fmt(m.averageNet)}`}))} height={80}/>
    <View style={{flexDirection: 'row'}}>{data.months.map(m => <T key={m.month} size={8} color={c.muted} style={{flex: 1, textAlign: 'center'}}>{name(m.month)}</T>)}</View>
    {data.months.filter(m => m.occurrences > 0).map(m => <View key={m.month} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 4}}>
      <Row><T size={11} bold style={{flex: 1}}>{name(m.month)}</T><T size={11} bold color={netColor(c, m.averageNet)}>{ctx.fmt(m.averageNet)}</T></Row>
      <T size={10} color={c.muted}>{t('Tổng lãi/lỗ')} {ctx.fmt(m.totalNet)} · {t('Số năm có giao dịch')} {m.occurrences} · {t('Số năm có lãi')} {m.winningOccurrences}</T>
    </View>)}
  </Card>;
}

export function ProjectionView({data, ctx}: { data: ProjectionReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  return <Card>
    <T size={13} bold>{t('Ước tính theo nhịp hiện tại')}</T>
    <T size={10} color={c.muted}>{t('Ước tính kéo dài mức lãi/lỗ trung bình mỗi ngày của 30 ngày gần nhất — không phải dự báo hay cam kết.')}</T>
    {data.observedDays < 30 ? <T size={10} color={c.warning}>{t('Lịch sử giao dịch ngắn hơn 30 ngày nên ước tính kém tin cậy')} ({data.observedDays}/30)</T> : null}
    <T size={10} color={c.muted}>{t('Tính đến')}: {dateLabel(data.asOf)}</T>
    <Stats>
      <Stat label={t('Lãi/lỗ từ đầu tháng')} value={ctx.fmt(data.monthToDateNet)} color={netColor(c, data.monthToDateNet)}/>
      <Stat label={t('Số ngày đã qua')} value={`${data.daysElapsed} / ${data.daysElapsed + data.daysRemaining}`}/>
      <Stat label={t('Nhịp mỗi ngày (30 ngày)')} value={ctx.fmt(data.dailyRunRate30)}/>
      <Stat label={t('Ước tính cuối tháng')} value={ctx.fmt(data.projectedMonthEnd)} color={netColor(c, data.projectedMonthEnd)}/>
      <Stat label={t('Ước tính 30 ngày tới')} value={ctx.fmt(data.projectedNext30)}/>
      <Stat label={t('Quy đổi theo năm')} value={ctx.fmt(data.projectedYear)}/>
      <Stat label={t('Lãi/lỗ 30 ngày gần nhất')} value={ctx.fmt(data.trailing30)}/>
      <Stat label={t('Lãi/lỗ 90 ngày gần nhất')} value={ctx.fmt(data.trailing90)}/>
    </Stats>
  </Card>;
}

export function LedgerView({data, ctx}: { data: LedgerReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const [type, setType] = useState('');
  const [shown, setShown] = useState(50);
  const rows = data.rows.filter(row => !type || row.type === type);
  return <Card>
    <T size={13} bold>{t('Sổ giao dịch')}</T>
    <Stats>
      <Stat label={t('Số giao dịch')} value={String(data.totals.count)}/>
      <Stat label={t('Lãi/lỗ')} value={ctx.fmt(data.totals.net)} color={netColor(c, data.totals.net)}/>
    </Stats>
    <Chips value={type} onChange={value => { setType(value); setShown(50); }} values={[{value: '', label: t('Tất cả loại')},
      ...Object.entries(TYPE_LABEL).map(([value, label]) => ({value, label: t(label)}))]}/>
    {data.truncated ? <T size={10} color={c.warning}>{t('Chỉ hiển thị các dòng mới nhất; hãy thu hẹp khoảng ngày để xem dòng cũ hơn')} ({data.limit})</T> : null}
    {rows.slice(0, shown).map((row, index) => <View key={index} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 1}}>
      <Row><T size={11} bold style={{flex: 1}}>{t(TYPE_LABEL[row.type] ?? row.type)} · {row.accountName}</T><T size={11} bold>{ctx.fmt(row.amount)}</T></Row>
      <T size={10} color={c.muted}>{dateLabel(row.at.slice(0, 16))} · {t('Lũy kế')} {ctx.fmt(row.runningNet)}</T>
    </View>)}
    <Button label={t('Chia sẻ CSV')} kind="secondary" onPress={() => Share.share({message: toCsv(['at', 'account', 'type', 'amount', 'net', 'running_net', 'currency'],
      rows.map(r => [r.at, r.accountName, r.type, r.amount, r.signedNet, r.runningNet, ctx.currency]))})}/>
    {rows.length > shown ? <Button label={t('Xem thêm')} kind="secondary" onPress={() => setShown(shown + 50)}/> : null}
  </Card>;
}

export function OverviewView({data, ctx}: { data: OverviewReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const change = data.monthNetChange;
  return <Card>
    <T size={13} bold>{t('Tổng quan')}</T>
    <TotalsStats totals={data.totals} ctx={ctx}/>
    <Stats>
      <Stat label={t('Lãi/lỗ + thưởng')} value={ctx.fmt(data.totals.netWithBonus)} color={netColor(c, data.totals.netWithBonus)}/>
      <Stat label={t('Đã thu hồi')} value={data.withdrawalToDepositPct == null ? '—' : `${data.withdrawalToDepositPct}%`}/>
      <Stat label={t('Số giao dịch')} value={String(data.totals.count)}/>
      <Stat label={t('Giao dịch trung bình')} value={ctx.fmt(data.averageTransaction)}/>
      <Stat label={t('Tài khoản hoạt động')} value={String(data.activeAccounts)}/>
      <Stat label={t('Ngày có giao dịch')} value={String(data.activeDays)}/>
      {data.lastAt ? <Stat label={t('Giao dịch gần nhất')} value={dateLabel(data.lastAt.slice(0, 16))}/> : null}
    </Stats>
    <T size={11} bold>{t('So với tháng trước')}</T>
    <Stats>
      <Stat label={data.currentMonth} value={ctx.fmt(data.currentMonthNet)} color={netColor(c, data.currentMonthNet)}/>
      <Stat label={t('Tháng trước')} value={ctx.fmt(data.previousMonthNet)} color={netColor(c, data.previousMonthNet)}/>
      <Stat label={t('Thay đổi')} value={ctx.fmt(change)} color={change === 0 ? c.muted : netColor(c, change)}/>
      {data.bestAccount ? <Stat label={t('Tài khoản tốt nhất')} value={`${data.bestAccount.accountName} · ${ctx.fmt(data.bestAccount.net)}`} color={c.success}/> : null}
      {data.worstAccount ? <Stat label={t('Tài khoản tệ nhất')} value={`${data.worstAccount.accountName} · ${ctx.fmt(data.worstAccount.net)}`} color={c.error}/> : null}
    </Stats>
  </Card>;
}

export function MatrixView({data, ctx}: { data: MatrixReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const [cumulative, setCumulative] = useState(false);
  const cells = (row: MatrixReport['rows'][number]) => cumulative ? row.cumulative : row.cells;
  const totals = cumulative ? data.cumulativeTotals : data.monthTotals;
  const maxAbs = Math.max(1, ...data.rows.flatMap(row => cells(row).map(Math.abs)));
  return <Card>
    <T size={13} bold>{t('Tài khoản × tháng')}</T>
    <T size={10} color={c.muted}>{t('Lãi/lỗ (rút − nạp) theo từng tài khoản và tháng; màu càng đậm thì giá trị càng lớn.')}</T>
    <Chips value={cumulative ? 'cumulative' : 'monthly'} onChange={value => setCumulative(value === 'cumulative')}
           values={[{value: 'monthly', label: t('Lãi/lỗ')}, {value: 'cumulative', label: t('Lãi/lỗ lũy kế (tháng)')}]}/>
    {data.rows.map(row => <View key={row.accountId} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 3}}>
      <Row><T size={12} bold style={{flex: 1}}>{row.accountName}</T><T size={12} bold color={netColor(c, row.total)}>{ctx.fmt(row.total)}</T></Row>
      <View style={{flexDirection: 'row', gap: 2}}>{cells(row).map((cell, i) => <View key={i} accessibilityLabel={`${data.months[i]} · ${ctx.fmt(cell)}`}
        style={{flex: 1, height: 22, borderRadius: 3, backgroundColor: cell ? (cell > 0 ? c.success : c.error) : c.border,
          opacity: cell ? 0.25 + 0.75 * Math.abs(cell) / maxAbs : 0.4}}/>)}</View>
    </View>)}
    <Row><T size={9} color={c.muted}>{data.months[0]}</T><View style={{flex: 1}}/><T size={9} color={c.muted}>{data.months[data.months.length - 1]}</T></Row>
    <T size={11} bold>{t('Theo tháng')}</T>
    {data.months.map((month, i) => <Row key={month}><T size={11} style={{flex: 1}}>{month}</T>
      <T size={11} bold color={totals[i] === 0 ? c.muted : netColor(c, totals[i])}>{ctx.fmt(totals[i])}</T></Row>)}
  </Card>;
}

export function DrawdownsView({data, ctx}: { data: DrawdownReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  return <Card>
    <T size={13} bold>{t('Các đợt sụt giảm')}</T>
    <T size={10} color={c.muted}>{t('Một đợt bắt đầu khi lãi/lỗ lũy kế thấp hơn đỉnh trước và kết thúc khi lấy lại đỉnh đó. Hiển thị 20 đợt sâu nhất.')}</T>
    <Stats>
      <Stat label={t('Số đợt')} value={String(data.count)}/>
      <Stat label={t('Sụt giảm sâu nhất')} value={ctx.fmt(data.deepest)} color={c.error}/>
      <Stat label={t('Dài nhất (ngày)')} value={String(data.longestDays)}/>
      <Stat label={t('Sụt giảm hiện tại')} value={t(data.ongoing ? 'Đang diễn ra' : 'Đang ở đỉnh')} color={data.ongoing ? c.error : c.success}/>
    </Stats>
    {data.episodes.length === 0 ? <T size={11} color={c.muted}>{t('Không có đợt sụt giảm nào trong khoảng này.')}</T> : null}
    {data.episodes.map(e => <View key={e.startDate} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 1}}>
      <Row><T size={12} bold style={{flex: 1}}>{dateLabel(e.startDate)} → {e.recoveryDate ? dateLabel(e.recoveryDate) : t('Đang diễn ra')}</T><T size={12} bold color={c.error}>{ctx.fmt(e.depth)}</T></Row>
      <T size={10} color={c.muted}>{t('Ngày đỉnh')} {dateLabel(e.peakDate)} · {t('Đáy')} {dateLabel(e.troughDate)}</T>
      <T size={10} color={c.muted}>{t('Ngày đến đáy')} {e.daysToTrough} · {t('Ngày phục hồi')} {e.daysToRecover ?? '—'} · {t('Thời gian (ngày)')} {e.durationDays}</T>
    </View>)}
  </Card>;
}

export function CadenceView({data}: { data: CadenceReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const days = (value: number | null) => value == null ? '—' : String(value);
  return <Card>
    <T size={13} bold>{t('Nhịp & vòng quay vốn')}</T>
    <T size={10} color={c.muted}>{t('Khoảng cách là số ngày giữa hai giao dịch liên tiếp của một tài khoản. Vòng quay là số ngày từ lần nạp gần nhất đến mỗi lần rút sau đó.')}</T>
    <Stats>
      <Stat label={t('Khoảng cách TB (ngày)')} value={days(data.averageGapDays)}/>
      <Stat label={t('Nạp → rút (ngày)')} value={days(data.avgDaysDepositToWithdrawal)}/>
    </Stats>
    {data.rows.map(row => <View key={row.accountId} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 1}}>
      <Row><T size={12} bold style={{flex: 1}}>{row.accountName}</T><T size={11}>{t('Số giao dịch')} {row.transactions}</T></Row>
      <T size={10} color={c.muted}>{t('Khoảng cách TB (ngày)')} {days(row.averageGapDays)} · {t('Nạp → rút (ngày)')} {days(row.avgDaysDepositToWithdrawal)}</T>
      {row.longestGapFrom ? <T size={10} color={c.muted}>{t('Khoảng cách dài nhất (ngày)')} {row.longestGapDays} · {dateLabel(row.longestGapFrom)} → {dateLabel(row.longestGapTo ?? '')}</T> : null}
    </View>)}
  </Card>;
}

export function GoalsView({data, ctx, onSave, onDelete}: {
  data: GoalsReport; ctx: ReportCtx; onSave: (period: string, target: number) => Promise<boolean>; onDelete: (id: number) => void
}) {
  const t = useT();
  const {colors: c} = useTheme();
  const [period, setPeriod] = useState('MONTH');
  const [target, setTarget] = useState('');
  const amount = parseAmount(target);
  return <Card>
    <T size={13} bold>{t('Mục tiêu')}</T>
    <T size={10} color={c.muted}>{t('Đặt mục tiêu lãi/lỗ (rút − nạp) theo tháng hoặc năm. Vạch đứng cho biết đã qua bao nhiêu phần của kỳ.')}</T>
    {data.goals.length === 0 ? <T size={11} color={c.muted}>{t('Chưa có mục tiêu cho loại tiền này.')}</T> : null}
    {data.goals.map(goal => <View key={goal.id} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 8, gap: 4}}>
      <Row><T size={12} bold style={{flex: 1}}>{t(goal.period === 'MONTH' ? 'Theo tháng (mục tiêu)' : 'Theo năm (mục tiêu)')} · {ctx.fmt(goal.target)}</T>
        <T size={10} bold color={goal.reached || goal.onTrack ? c.success : c.warning}>{t(goal.reached ? 'Đã đạt' : goal.onTrack ? 'Đúng tiến độ' : 'Chậm tiến độ')}</T></Row>
      <View accessibilityRole="progressbar" accessibilityLabel={`${goal.pct}%`} style={{height: 10, borderRadius: 5, backgroundColor: c.border, justifyContent: 'center'}}>
        <View style={{width: `${Math.min(100, Math.max(0, goal.pct))}%`, height: '100%', borderRadius: 5, backgroundColor: c.primary}}/>
        <View style={{position: 'absolute', left: `${Math.min(100, goal.elapsedPct)}%`, width: 2, top: -3, bottom: -3, backgroundColor: c.text}}/>
      </View>
      <T size={10} color={c.muted}>{t('Đã đạt được')} {ctx.fmt(goal.achieved)} ({goal.pct}%) · {t('Đã qua')} {goal.elapsedPct}%</T>
      <T size={10} color={c.muted}>{t('Còn thiếu')} {ctx.fmt(goal.remaining)} · {t('Cần mỗi ngày')} {ctx.fmt(goal.requiredDaily)} · {goal.daysRemaining}d</T>
      <Button label={t('Xóa mục tiêu')} kind="secondary" onPress={() => onDelete(goal.id)}/>
    </View>)}
    <T size={11} bold>{t('Đặt mục tiêu')} ({ctx.currency})</T>
    <Chips value={period} onChange={setPeriod} values={[{value: 'MONTH', label: t('Theo tháng (mục tiêu)')}, {value: 'YEAR', label: t('Theo năm (mục tiêu)')}]}/>
    <Field label={t('Mục tiêu lãi/lỗ')} keyboardType="numeric" value={target} onChangeText={setTarget} placeholder="0"/>
    <Button label={t('Lưu mục tiêu')} disabled={!(amount > 0)} onPress={() => { onSave(period, amount).then(ok => ok && setTarget('')); }}/>
  </Card>;
}

export const INSIGHT_TEXT: Record<string, string> = {
  DORMANT_ACCOUNT: '{{account}} không có giao dịch trong {{value}} ngày (gần nhất {{date}}).',
  NO_RECENT_ACTIVITY: 'Không có giao dịch nào trong {{value}} ngày (gần nhất {{date}}).',
  LOSING_STREAK: 'Chuỗi thua: {{value}} ngày giao dịch liên tiếp có lãi/lỗ âm.',
  WINNING_STREAK: 'Chuỗi thắng: {{value}} ngày giao dịch liên tiếp có lãi/lỗ dương.',
  DEEP_DRAWDOWN: 'Lãi/lỗ lũy kế đang thấp hơn đỉnh {{value}}%.',
  NEGATIVE_MONTH: 'Tháng này đang âm: {{value}}.', POSITIVE_MONTH: 'Tháng này đang dương: {{value}}.',
  LARGE_TRANSACTION_DEPOSIT: 'Khoản nạp lớn bất thường {{value}} ở {{account}} ({{date}}).',
  LARGE_TRANSACTION_WITHDRAWAL: 'Khoản rút lớn bất thường {{value}} ở {{account}} ({{date}}).',
  LARGE_TRANSACTION_BONUS: 'Khoản thưởng lớn bất thường {{value}} ở {{account}} ({{date}}).',
};
const SEVERITY: Record<string, string> = {WARN: 'Cảnh báo', INFO: 'Thông tin', GOOD: 'Tốt'};

export function insightMessage(t: ReturnType<typeof useT>, item: InsightsReport['insights'][number], fmt: (value: number) => string) {
  const money = item.code === 'NEGATIVE_MONTH' || item.code === 'POSITIVE_MONTH' || item.code.startsWith('LARGE_TRANSACTION');
  return t(INSIGHT_TEXT[item.code] ?? item.code, {
    account: item.accountName ?? '', date: item.date ? dateLabel(item.date) : '',
    value: item.value == null ? '' : money ? fmt(item.value) : String(item.value)
  });
}

export function InsightsView({data, ctx}: { data: InsightsReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const tone = (severity: string) => severity === 'WARN' ? c.error : severity === 'GOOD' ? c.success : c.primary;
  const text = (item: InsightsReport['insights'][number]) => insightMessage(t, item, ctx.fmt);
  return <Card>
    <T size={13} bold>{t('Nhận xét tự động')}</T>
    <T size={10} color={c.muted}>{t('Các nhận xét tự động từ hoạt động gần đây. Cảnh báo hiển thị trước.')}</T>
    {data.insights.length === 0 ? <T size={11} color={c.muted}>{t('Không có gì đáng chú ý trong khoảng này.')}</T> : null}
    {data.insights.map((item, index) => <View key={index} style={{borderLeftWidth: 4, borderColor: tone(item.severity), paddingLeft: 8, gap: 1}}>
      <T size={9} bold color={tone(item.severity)}>{t(SEVERITY[item.severity] ?? item.severity).toUpperCase()}</T>
      <T size={12}>{text(item)}</T>
    </View>)}
  </Card>;
}

export function PerformanceView({data, ctx}: { data: PerformanceReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const ratio = (value: number | null) => value == null ? '—' : String(value);
  return <Card>
    <T size={13} bold>{t('Chỉ số hiệu suất')}</T>
    <T size={10} color={c.muted}>{t('Tính từ lãi/lỗ theo ngày trên các ngày có giao dịch. Profit factor = tổng ngày lãi ÷ tổng ngày lỗ; payoff = lãi TB ÷ lỗ TB; recovery factor = lãi/lỗ ÷ sụt giảm tối đa.')}</T>
    <Stats>
      <Stat label={t('Lãi/lỗ')} value={ctx.fmt(data.totalNet)} color={netColor(c, data.totalNet)}/>
      <Stat label={t('Tỷ lệ ngày thắng')} value={data.winRatePct == null ? '—' : `${data.winRatePct}%`}/>
      <Stat label="Profit factor" value={ratio(data.profitFactor)}/>
      <Stat label={t('Tỷ lệ payoff')} value={ratio(data.payoffRatio)}/>
      <Stat label={t('Kỳ vọng / ngày giao dịch')} value={ctx.fmt(data.expectancyPerDay)}/>
      <Stat label={t('Lãi/lỗ trung vị theo ngày')} value={ctx.fmt(data.medianDayNet)}/>
      <Stat label={t('Ngày lãi trung bình')} value={ctx.fmt(data.averageWin)} color={c.success}/>
      <Stat label={t('Ngày lỗ trung bình')} value={ctx.fmt(data.averageLoss)} color={c.error}/>
      <Stat label={t('Ngày lãi lớn nhất')} value={ctx.fmt(data.largestWin)} color={c.success}/>
      <Stat label={t('Ngày lỗ lớn nhất')} value={ctx.fmt(data.largestLoss)} color={c.error}/>
      <Stat label={t('Tổng lãi')} value={ctx.fmt(data.grossWin)}/>
      <Stat label={t('Tổng lỗ')} value={ctx.fmt(data.grossLoss)}/>
      <Stat label={t('Sụt giảm tối đa')} value={ctx.fmt(data.maxDrawdown)}/>
      <Stat label="Recovery factor" value={ratio(data.recoveryFactor)}/>
      <Stat label={t('Ngày có giao dịch')} value={`${data.activeDays} (${data.winDays} / ${data.lossDays})`}/>
    </Stats>
  </Card>;
}

export function LotsView({data, ctx}: { data: LotsReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const [shown, setShown] = useState(30);
  const maxOpen = Math.max(...data.aging.map(b => b.outstanding)) || 1;
  return <Card>
    <T size={13} bold>{t('Lô vốn (FIFO)')}</T>
    <T size={10} color={c.muted}>{t('Mỗi lần nạp là một lô; các lần rút trả lô mở cũ nhất trước (thưởng không hoàn vốn). Vốn chưa thu hồi được tính tuổi từ ngày nạp.')}</T>
    <Stats>
      <Stat label={t('Số lô')} value={`${data.lotCount} (${data.recoveredLots} ${t('đã thu hồi')})`}/>
      <Stat label={t('Số ngày thu hồi TB')} value={data.averageDaysToRecover == null ? '—' : String(data.averageDaysToRecover)}/>
      <Stat label={t('Nạp')} value={ctx.fmt(data.totalDeposited)}/>
      <Stat label={t('Đã thu hồi')} value={ctx.fmt(data.totalRecovered)}/>
      <Stat label={t('Còn lại')} value={ctx.fmt(data.outstanding)} color={data.outstanding > 0 ? c.error : c.success}/>
    </Stats>
    <T size={11} bold>{t('Vốn chưa thu hồi theo tuổi')}</T>
    {data.aging.map(b => <View key={b.bucket} style={{gap: 2}}>
      <Row><T size={11} style={{flex: 1}}>{b.bucket} {t('ngày')} · {b.lots} {t('lô')}</T><T size={11} bold>{ctx.fmt(b.outstanding)}</T></Row>
      <View style={{height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden'}}>
        <View style={{width: `${b.outstanding / maxOpen * 100}%`, height: '100%', backgroundColor: c.error}}/></View>
    </View>)}
    {data.truncated ? <T size={10} color={c.warning}>{t('Chỉ hiển thị 200 lô mới nhất.')}</T> : null}
    {data.lots.slice(0, shown).map((lot, index) => <View key={index} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 1}}>
      <Row><T size={11} bold style={{flex: 1}}>{lot.accountName} · {dateLabel(lot.depositDate)}</T><T size={11} bold>{ctx.fmt(lot.amount)}</T></Row>
      <T size={10} color={c.muted}>{t('Đã thu hồi')} {ctx.fmt(lot.recovered)} · {t('Còn lại')} {ctx.fmt(lot.outstanding)} · {t('Tuổi (ngày)')} {lot.ageDays}</T>
      {lot.recoveredDate ? <T size={10} color={c.muted}>{t('Phục hồi')} {dateLabel(lot.recoveredDate)} · {lot.daysToRecover}</T> : null}
    </View>)}
    {data.lots.length > shown ? <Button label={t('Xem thêm')} kind="secondary" onPress={() => setShown(shown + 30)}/> : null}
  </Card>;
}

const CONCENTRATION: Record<string, string> = {NONE: 'Không có vốn đang mở', DIVERSIFIED: 'Phân tán', MODERATE: 'Vừa phải', CONCENTRATED: 'Tập trung'};

export function AllocationView({data, ctx}: { data: AllocationReport; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  const pct = (value: number | null) => value == null ? '—' : `${value}%`;
  return <Card>
    <T size={13} bold>{t('Phân bổ vốn')}</T>
    <T size={10} color={c.muted}>{t('Vốn đang mở = tiền nạp chưa được rút về (không âm), theo từng tài khoản. HHI là tổng bình phương tỷ trọng: dưới 1.500 phân tán, 1.500–2.500 vừa phải, trên 2.500 tập trung.')}</T>
    <Stats>
      <Stat label={t('Vốn đang mở')} value={ctx.fmt(data.totalOutstanding)}/>
      <Stat label={t('Nạp')} value={ctx.fmt(data.totalDeposits)}/>
      <Stat label="HHI" value={data.hhi == null ? '—' : String(data.hhi)}/>
      <Stat label={t('Mức tập trung')} value={t(CONCENTRATION[data.concentration])} color={data.concentration === 'CONCENTRATED' ? c.error : data.concentration === 'DIVERSIFIED' ? c.success : undefined}/>
      <Stat label={t('Tỷ trọng tài khoản lớn nhất')} value={pct(data.topSharePct)}/>
    </Stats>
    {data.rows.map(row => <View key={row.accountId} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 3}}>
      <Row><T size={12} bold style={{flex: 1}}>{row.accountName}</T><T size={12} bold>{ctx.fmt(row.outstanding)}</T></Row>
      <View accessibilityRole="progressbar" accessibilityLabel={pct(row.outstandingSharePct)} style={{height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden'}}>
        <View style={{width: `${Math.min(100, row.outstandingSharePct ?? 0)}%`, height: '100%', backgroundColor: c.primary}}/></View>
      <T size={10} color={c.muted}>{t('Tỷ trọng vốn đang mở')} {pct(row.outstandingSharePct)} · {t('Tỷ trọng tiền nạp')} {pct(row.depositSharePct)}</T>
      <T size={10} color={c.muted}>{t('Nạp')} {ctx.fmt(row.deposits)} · {t('Rút')} {ctx.fmt(row.withdrawals)}</T>
    </View>)}
  </Card>;
}
