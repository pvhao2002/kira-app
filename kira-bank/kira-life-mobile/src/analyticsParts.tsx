import React from 'react';
import {View} from 'react-native';
import {dictionary, Lang, useT} from './i18n';
import {ReportTotals} from './investmentApi';
import {useTheme} from './theme';
import {T} from './ui';

const extra: Record<string, string> = {
  'Báo cáo': 'Reports',
  'Báo cáo đầu tư': 'Investment reports',
  'Phân tích chi tiết giao dịch nạp, rút và thưởng đã hoàn tất.': 'Detailed analysis of completed deposits, withdrawals and bonuses.',
  'Tất cả tài khoản': 'All accounts',
  '24 tháng': '24 months', '1 tháng': '1 month',
  'Lãi/lỗ = rút − nạp. Tiền thưởng hiển thị riêng. Các loại tiền tệ không bao giờ bị cộng lẫn.':
    'Net = withdrawals − deposits. Bonuses are shown separately. Currencies are never mixed.',
  'Không có giao dịch hoàn tất trong khoảng này.': 'No completed transactions in this range.',
  'Lãi/lỗ theo kỳ': 'Periodic P&L', 'Xếp hạng tài khoản': 'Account ranking', 'Đường vốn & sụt giảm': 'Equity & drawdown',
  'Quy luật giao dịch': 'Activity patterns', 'Quy mô giao dịch': 'Transaction sizes', 'So sánh kỳ': 'Period comparison',
  'Theo ngày': 'By day', 'Theo tuần': 'By week', 'Theo tháng': 'By month', 'Theo quý': 'By quarter', 'Theo năm': 'By year',
  'Nạp': 'Deposits', 'Rút': 'Withdrawals', 'Lãi/lỗ': 'Net', 'Số giao dịch': 'Transactions', 'Lãi/lỗ + thưởng': 'Net + bonus',
  'Lãi/lỗ trung bình / kỳ': 'Average net / period', 'Kỳ có lãi': 'Profitable periods', 'Kỳ thua lỗ': 'Losing periods',
  'Kỳ tốt nhất': 'Best period', 'Kỳ tệ nhất': 'Worst period', 'Lũy kế': 'Cumulative',
  'Tỷ trọng': 'Share of net', 'Nạp TB': 'Avg deposit', 'Rút TB': 'Avg withdrawal', 'Hoạt động gần nhất': 'Last activity',
  '{{n}} ngày trước': '{{n}} days ago',
  'Lãi/lỗ cuối kỳ': 'Final net', 'Đỉnh lãi/lỗ': 'Peak net', 'Sụt giảm tối đa': 'Max drawdown', 'Sụt giảm hiện tại': 'Current drawdown',
  'Ngày có giao dịch': 'Active days', 'Ngày có lãi': 'Winning days', 'Ngày thua lỗ': 'Losing days', 'Tỷ lệ ngày thắng': 'Win rate',
  'Chuỗi thắng dài nhất': 'Longest win streak', 'Chuỗi thua dài nhất': 'Longest loss streak',
  'Chuỗi hiện tại (+thắng / −thua)': 'Current streak (+win / −loss)', 'Ngày tốt nhất': 'Best day', 'Ngày tệ nhất': 'Worst day',
  'Lãi/lỗ lũy kế': 'Cumulative net', 'Sụt giảm so với đỉnh': 'Drawdown from peak',
  'Thứ giao dịch nhiều nhất': 'Busiest weekday', 'Giờ giao dịch nhiều nhất': 'Busiest hour',
  'Giao dịch theo thứ và giờ': 'Transactions by weekday and hour', 'Theo thứ trong tuần': 'By weekday',
  'T2': 'Mon', 'T3': 'Tue', 'T4': 'Wed', 'T5': 'Thu', 'T6': 'Fri', 'T7': 'Sat', 'CN': 'Sun',
  'Trung bình': 'Average', 'Trung vị': 'Median', 'Biểu đồ quy mô giao dịch': 'Size histogram',
  'Top 10 giao dịch lớn nhất': 'Top 10 largest transactions',
  'Kỳ trước': 'Previous period', 'Kỳ đã chọn': 'Selected period', 'Thay đổi': 'Change',
  'Giao dịch hoàn tất': 'Completed transactions',
  'Ngày trong tháng nhiều giao dịch nhất': 'Busiest day of month', 'Lãi/lỗ theo ngày trong tháng': 'Net by day of month',
  'Phân bổ vốn': 'Capital allocation', 'Vốn đang mở': 'Capital at risk', 'Mức tập trung': 'Concentration', 'Tỷ trọng tài khoản lớn nhất': 'Largest account share',
  'Tỷ trọng vốn đang mở': 'Share of capital at risk', 'Tỷ trọng tiền nạp': 'Share of deposits', 'Phân tán': 'Diversified', 'Vừa phải': 'Moderate', 'Tập trung': 'Concentrated',
  'Không có vốn đang mở': 'No capital at risk',
  'Vốn đang mở = tiền nạp chưa được rút về (không âm), theo từng tài khoản. HHI là tổng bình phương tỷ trọng: dưới 1.500 phân tán, 1.500–2.500 vừa phải, trên 2.500 tập trung.':
    'Outstanding capital = deposits not yet withdrawn (never below zero), per account. HHI sums the squared shares: under 1,500 diversified, 1,500–2,500 moderate, above 2,500 concentrated.',
  'Không tìm thấy loại báo cáo này.': 'Report type not found.',
  'Khoảng ngày không hợp lệ: ngày bắt đầu phải trước hoặc bằng ngày kết thúc.': 'Invalid date range: the start date must not be after the end date.',
  'Khoảng ngày tối đa là 5 năm.': 'The date range can be at most 5 years.', 'Cách nhóm kỳ không hợp lệ.': 'Invalid period grouping.',
  'Không tìm thấy mục tiêu.': 'Goal not found.', 'Bạn chưa có tài khoản đầu tư nào dùng loại tiền này.': 'You have no investment account in this currency.',
  'Bạn đã đạt số mục tiêu tối đa (20).': 'You have reached the maximum number of goals (20).',
  'So với: từ ngày (YYYY-MM-DD, tùy chọn)': 'Compare with: from (YYYY-MM-DD, optional)', 'So với: đến ngày (YYYY-MM-DD, tùy chọn)': 'Compare with: to (YYYY-MM-DD, optional)',
  'Nhập đủ cả hai ngày hợp lệ (từ ≤ đến) hoặc để trống để so với kỳ liền trước.': 'Enter both dates (from ≤ to) or leave both empty to compare with the previous period.',
  'Lãi/lỗ lũy kế (tháng)': 'Cumulative net',
  'Lô vốn (FIFO)': 'Capital lots (FIFO)', 'Số lô': 'Lots', 'đã thu hồi': 'recovered', 'Số ngày thu hồi TB': 'Avg days to recover',
  'Vốn chưa thu hồi theo tuổi': 'Outstanding capital by age', 'ngày': 'days', 'lô': 'lots', 'Chỉ hiển thị 200 lô mới nhất.': 'Showing the 200 newest lots.',
  'Tuổi (ngày)': 'Age (days)',
  'Mỗi lần nạp là một lô; các lần rút trả lô mở cũ nhất trước (thưởng không hoàn vốn). Vốn chưa thu hồi được tính tuổi từ ngày nạp.':
    'Each deposit is a lot; withdrawals repay the oldest open lot first (bonuses do not repay capital). Outstanding capital is aged from its deposit date.',
  'Top 5 ngày tốt nhất': 'Top 5 best days', 'Top 5 ngày tệ nhất': 'Top 5 worst days',
  'Chỉ số hiệu suất': 'Performance stats',
  'Tính từ lãi/lỗ theo ngày trên các ngày có giao dịch. Profit factor = tổng ngày lãi ÷ tổng ngày lỗ; payoff = lãi TB ÷ lỗ TB; recovery factor = lãi/lỗ ÷ sụt giảm tối đa.':
    'Computed from daily net over active days. Profit factor = gross winning days ÷ gross losing days; payoff = average win ÷ average loss; recovery factor = net ÷ max drawdown.',
  'Tỷ lệ payoff': 'Payoff ratio', 'Kỳ vọng / ngày giao dịch': 'Expectancy / active day', 'Lãi/lỗ trung vị theo ngày': 'Median day net',
  'Ngày lãi trung bình': 'Average winning day', 'Ngày lỗ trung bình': 'Average losing day', 'Ngày lãi lớn nhất': 'Largest winning day',
  'Ngày lỗ lớn nhất': 'Largest losing day', 'Tổng lãi': 'Gross winnings', 'Tổng lỗ': 'Gross losses', 'Chia sẻ CSV': 'Share CSV',
  'Nhận xét tự động': 'Insights', 'Các nhận xét tự động từ hoạt động gần đây. Cảnh báo hiển thị trước.': 'Automatic observations from your recent activity. Warnings first.',
  'Không có gì đáng chú ý trong khoảng này.': 'Nothing notable in this range.', 'Cảnh báo': 'Warning', 'Thông tin': 'Info', 'Tốt': 'Good',
  '{{account}} không có giao dịch trong {{value}} ngày (gần nhất {{date}}).': '{{account}} has had no transactions for {{value}} days (last {{date}}).',
  'Không có giao dịch nào trong {{value}} ngày (gần nhất {{date}}).': 'No transactions for {{value}} days (last {{date}}).',
  'Chuỗi thua: {{value}} ngày giao dịch liên tiếp có lãi/lỗ âm.': 'Losing streak: {{value}} active days in a row with a negative net.',
  'Chuỗi thắng: {{value}} ngày giao dịch liên tiếp có lãi/lỗ dương.': 'Winning streak: {{value}} active days in a row with a positive net.',
  'Lãi/lỗ lũy kế đang thấp hơn đỉnh {{value}}%.': 'Cumulative net is {{value}}% below its peak.',
  'Tháng này đang âm: {{value}}.': 'This month is negative so far: {{value}}.', 'Tháng này đang dương: {{value}}.': 'This month is positive so far: {{value}}.',
  'Khoản nạp lớn bất thường {{value}} ở {{account}} ({{date}}).': 'Unusually large deposit of {{value}} on {{account}} ({{date}}).',
  'Khoản rút lớn bất thường {{value}} ở {{account}} ({{date}}).': 'Unusually large withdrawal of {{value}} on {{account}} ({{date}}).',
  'Khoản thưởng lớn bất thường {{value}} ở {{account}} ({{date}}).': 'Unusually large bonus of {{value}} on {{account}} ({{date}}).',
  'Mục tiêu': 'Goals', 'Chưa có mục tiêu cho loại tiền này.': 'No goals for this currency yet.',
  'Đặt mục tiêu lãi/lỗ (rút − nạp) theo tháng hoặc năm. Vạch đứng cho biết đã qua bao nhiêu phần của kỳ.':
    'Set a net target (withdrawals − deposits) per calendar month or year. Progress is compared with how much of the period has elapsed.',
  'Theo tháng (mục tiêu)': 'Monthly', 'Theo năm (mục tiêu)': 'Yearly', 'Mục tiêu lãi/lỗ': 'Target net', 'Lưu mục tiêu': 'Save goal',
  'Đặt mục tiêu': 'Set a goal', 'Đã đạt': 'Reached', 'Đúng tiến độ': 'On track', 'Chậm tiến độ': 'Behind', 'Đã đạt được': 'Achieved',
  'Đã qua': 'Elapsed', 'Còn thiếu': 'Remaining', 'Cần mỗi ngày': 'Needed per day', 'Xóa mục tiêu': 'Delete goal',
  'Tổng quan': 'Overview', 'Tài khoản × tháng': 'Account × month', 'Các đợt sụt giảm': 'Drawdown episodes', 'Nhịp & vòng quay vốn': 'Cadence & turnaround',
  'Giao dịch trung bình': 'Average transaction', 'Tài khoản hoạt động': 'Active accounts', 'Giao dịch gần nhất': 'Last transaction',
  'So với tháng trước': 'Month over month', 'Tháng trước': 'Previous month', 'Tài khoản tốt nhất': 'Best account', 'Tài khoản tệ nhất': 'Worst account',
  'Lãi/lỗ (rút − nạp) theo từng tài khoản và tháng; màu càng đậm thì giá trị càng lớn.': 'Net (withdrawals − deposits) per account and calendar month; colour intensity shows magnitude.',
  'Một đợt bắt đầu khi lãi/lỗ lũy kế thấp hơn đỉnh trước và kết thúc khi lấy lại đỉnh đó. Hiển thị 20 đợt sâu nhất.':
    'An episode starts when cumulative net falls below its previous peak and ends when it regains that peak. Shows the 20 deepest.',
  'Số đợt': 'Episodes', 'Sụt giảm sâu nhất': 'Deepest drawdown', 'Dài nhất (ngày)': 'Longest (days)', 'Đang diễn ra': 'Ongoing', 'Đang ở đỉnh': 'At peak',
  'Không có đợt sụt giảm nào trong khoảng này.': 'No drawdowns in this range.', 'Ngày đỉnh': 'Peak date', 'Bắt đầu': 'Start', 'Đáy': 'Trough',
  'Phục hồi': 'Recovered', 'Độ sâu': 'Depth', 'Ngày đến đáy': 'Days to trough', 'Ngày phục hồi': 'Days to recover', 'Thời gian (ngày)': 'Duration (days)',
  'Khoảng cách là số ngày giữa hai giao dịch liên tiếp của một tài khoản. Vòng quay là số ngày từ lần nạp gần nhất đến mỗi lần rút sau đó.':
    'Gaps are the days between consecutive transactions of an account. Turnaround is the days from the latest deposit to each later withdrawal.',
  'Khoảng cách TB (ngày)': 'Average gap (days)', 'Nạp → rút (ngày)': 'Deposit → withdrawal (days)', 'Khoảng cách dài nhất (ngày)': 'Longest gap (days)',
  'Khoảng dài nhất giữa': 'Longest gap between',
  'Sổ giao dịch': 'Transaction ledger', 'Tất cả loại': 'All types', 'Xem thêm': 'Show more',
  'Chỉ hiển thị các dòng mới nhất; hãy thu hẹp khoảng ngày để xem dòng cũ hơn': 'Showing only the newest rows; narrow the date range to see older ones',
  'Hoàn vốn': 'Payback', 'Tính mùa vụ': 'Seasonality', 'Ước tính theo nhịp hiện tại': 'Run-rate projection',
  'Chỉ tính trong khoảng ngày đã chọn. Đã thu hồi = rút ÷ nạp; còn lại = nạp − rút (âm nghĩa là có lãi).':
    'Counts only the selected date range. Recovered = withdrawals ÷ deposits; outstanding = deposits − withdrawals (negative means profit).',
  'Đã thu hồi': 'Recovered', 'Còn lại': 'Outstanding', 'Tài khoản đã hoàn vốn': 'Accounts broke even',
  'Tài khoản chưa hoàn vốn': 'Accounts still outstanding', 'Ngày hoàn vốn': 'Break-even date', 'Số ngày để hoàn vốn': 'Days to break even',
  'Lãi/lỗ trung bình theo từng tháng trong năm, qua các năm trong khoảng đã chọn. Nên chọn khoảng từ 12 tháng.':
    'Average net for each calendar month, across the years in the range. Use a range of 12+ months.',
  'Tháng tốt nhất (TB)': 'Best month (avg)', 'Tháng tệ nhất (TB)': 'Worst month (avg)', 'Số năm có giao dịch': 'Years with activity',
  'Số năm có lãi': 'Winning years', 'Tổng lãi/lỗ': 'Total net', 'Lãi/lỗ trung bình': 'Average net',
  'Ước tính kéo dài mức lãi/lỗ trung bình mỗi ngày của 30 ngày gần nhất — không phải dự báo hay cam kết.':
    'An estimate that extends the last 30 days’ average daily net — not a forecast or a guarantee.',
  'Lịch sử giao dịch ngắn hơn 30 ngày nên ước tính kém tin cậy': 'Your history is shorter than 30 days, so the run-rate is less reliable',
  'Tính đến': 'As of', 'Lãi/lỗ từ đầu tháng': 'Month-to-date net', 'Số ngày đã qua': 'Days elapsed', 'Nhịp mỗi ngày (30 ngày)': 'Daily run-rate (30d)',
  'Ước tính cuối tháng': 'Projected month-end net', 'Ước tính 30 ngày tới': 'Projected next 30 days', 'Quy đổi theo năm': 'Annualized run-rate',
  'Lãi/lỗ 30 ngày gần nhất': 'Trailing 30-day net', 'Lãi/lỗ 90 ngày gần nhất': 'Trailing 90-day net', 'Số năm': 'Years',
  'Cuốn chiếu & biến động': 'Rolling & volatility', 'Lịch theo ngày': 'Daily calendar', 'Phân tích thưởng': 'Bonus analysis',
  'Lãi/lỗ TB / ngày hoạt động': 'Avg net / active day', 'Giao dịch TB / ngày hoạt động': 'Avg transactions / active day',
  '7 ngày gần nhất': 'Last 7 days', '30 ngày gần nhất': 'Last 30 days', 'Cửa sổ 7 ngày tốt nhất': 'Best 7-day window',
  'Cửa sổ 7 ngày tệ nhất': 'Worst 7-day window', 'Lãi/lỗ TB mỗi ngày': 'Average daily net', 'Biến động (σ theo ngày)': 'Volatility (daily σ)',
  'Biến động là độ lệch chuẩn mẫu của lãi/lỗ theo ngày trên mọi ngày trong khoảng, kể cả ngày không giao dịch.':
    'Volatility is the sample standard deviation of daily net over every day in the range, including inactive days.',
  'Cuốn chiếu 7 ngày': '7-day rolling', 'Cuốn chiếu 30 ngày': '30-day rolling',
  'Thưởng / tiền nạp': 'Bonus % of deposits', 'Thưởng / (lãi/lỗ + thưởng) dương': 'Bonus % of positive net + bonus',
  'Thưởng trung bình': 'Average bonus', 'Thưởng lớn nhất': 'Largest bonus', 'Số lần thưởng': 'Bonus count',
  'Theo tài khoản': 'By account', 'Theo tháng (thưởng)': 'By month',
};
// Never override strings other screens already translate.
for (const [key, value] of Object.entries(extra)) if (!(key in dictionary)) dictionary[key] = value;

export type ReportCtx = { lang: Lang; currency: string; fmt: (value: number) => string };

export function Stat({label, value, color}: { label: string; value: string; color?: string }) {
  const {colors: c} = useTheme();
  return <View style={{flexBasis: '47%', flexGrow: 1, minWidth: 130, paddingVertical: 4}}>
    <T size={10} color={c.muted}>{label}</T><T size={14} bold color={color}>{value}</T></View>;
}

export const Stats = ({children}: { children: React.ReactNode }) =>
  <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>{children}</View>;

/** Bars above/below a zero line; value sign picks colour. */
export function SignedBars({items, height = 110}: { items: { key: string; value: number; label: string }[]; height?: number }) {
  const {colors: c} = useTheme();
  const max = Math.max(1, ...items.map(item => Math.abs(item.value)));
  return <View>
    <View style={{height, flexDirection: 'row', alignItems: 'flex-end', gap: 1}}>{items.map(item =>
      <View key={item.key} accessibilityLabel={item.label} style={{
        flex: 1, height: `${Math.max(0, item.value) / max * 100}%`, backgroundColor: c.success,
        borderTopLeftRadius: 2, borderTopRightRadius: 2
      }}/>)}</View>
    <View style={{height: 1, backgroundColor: c.border}}/>
    <View style={{height, flexDirection: 'row', alignItems: 'flex-start', gap: 1}}>{items.map(item =>
      <View key={item.key} style={{
        flex: 1, height: `${Math.max(0, -item.value) / max * 100}%`, backgroundColor: c.error,
        borderBottomLeftRadius: 2, borderBottomRightRadius: 2
      }}/>)}</View>
  </View>;
}

export function TotalsStats({totals, ctx}: { totals: ReportTotals; ctx: ReportCtx }) {
  const t = useT();
  const {colors: c} = useTheme();
  return <Stats>
    <Stat label={t('Nạp')} value={ctx.fmt(totals.deposits)}/>
    <Stat label={t('Rút')} value={ctx.fmt(totals.withdrawals)}/>
    <Stat label={t('Thưởng')} value={ctx.fmt(totals.bonuses)}/>
    <Stat label={t('Lãi/lỗ')} value={ctx.fmt(totals.net)} color={totals.net < 0 ? c.error : c.success}/>
  </Stats>;
}

/** Parse a typed money amount in either locale style ("1.000.000", "1,000,000", "1,5", "1.5"); NaN when unreadable. */
export function parseAmount(input: string): number {
  const text = input.trim().replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) return Number(text.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) return Number(text.replace(/,/g, ''));
  return /^\d+([.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : NaN;
}

/** Sum a per-period series into at most `max` buckets (each labelled by its first period) so no period is dropped. */
export function bucketSum<T extends { key: string; value: number }>(items: T[], max = 80): { key: string; value: number }[] {
  if (items.length <= max) return items;
  const size = Math.ceil(items.length / max);
  return Array.from({length: Math.ceil(items.length / size)}, (_, i) => {
    const chunk = items.slice(i * size, (i + 1) * size);
    return {key: chunk[0].key, value: chunk.reduce((sum, item) => sum + item.value, 0)};
  });
}

/** Collapse a long series to at most `max` bars (last value of each chunk) so bars stay readable. */
export function downsample<T>(items: T[], max = 60): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  return Array.from({length: max}, (_, i) => items[Math.min(items.length - 1, Math.floor((i + 1) * step) - 1)]);
}

const csvCell = (value: string | number | null) => {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

/** Plain-text CSV for the system share sheet; formula-looking text cells are neutralised like on web. */
export const toCsv = (header: string[], rows: (string | number | null)[][]) =>
  [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
