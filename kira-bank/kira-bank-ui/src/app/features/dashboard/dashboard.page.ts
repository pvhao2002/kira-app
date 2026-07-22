import {ChangeDetectionStrategy, Component} from '@angular/core';

interface Kpi {
  label: string;
  value: string;
  trend: string;
  icon: string
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPage {
  readonly credit: Kpi[] = [
    {label: 'Tổng chi tiêu', value: '42.680.000 ₫', trend: '↑ 8,2% tháng này', icon: '▭'},
    {label: 'Dư nợ sao kê', value: '18.250.000 ₫', trend: '2 sao kê đang mở', icon: '▤'},
    {label: 'Cashback đang chờ', value: '1.840.000 ₫', trend: '4 khoản chờ nhận', icon: '◇'},
    {label: 'Cashback đã nhận', value: '5.240.000 ₫', trend: '↑ 12,4% tháng này', icon: '✓'}
  ];
  readonly invest: Kpi[] = [
    {label: 'Available Capital', value: '68.400.000 ₫', trend: '62% tổng số dư', icon: '◉'},
    {label: 'Locked Capital', value: '32.000.000 ₫', trend: '5 nhiệm vụ đang chạy', icon: '▣'},
    {label: 'Profit đã nhận', value: '8.650.000 ₫', trend: '↑ 8,7% tháng này', icon: '↗'},
    {label: 'Reward đã nhận', value: '2.180.000 ₫', trend: '3 khoản tháng này', icon: '☆'}
  ];
  readonly dues = [
    {bank: 'Vietcombank', card: '4821', date: 'Hạn 24/07', amount: '8.450.000 ₫', color: '#087f5b'},
    {bank: 'Techcombank', card: '7290', date: 'Hạn 27/07', amount: '6.800.000 ₫', color: '#dc2626'},
    {bank: 'VPBank', card: '3155', date: 'Hạn 29/07', amount: '3.000.000 ₫', color: '#15803d'}
  ];
}
