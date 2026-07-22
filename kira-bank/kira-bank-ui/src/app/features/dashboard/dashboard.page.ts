import {ChangeDetectionStrategy, Component} from '@angular/core';

interface Kpi {
  label: string;
  value: string;
  trend: string;
  icon: string
}

@Component({
  selector: 'app-dashboard',
  template: `<section class="page-heading"><div><span class="eyebrow">Thứ Tư, 22 tháng 7</span><h1>Tổng quan tài chính</h1><p>Chào buổi chiều. Đây là bức tranh tài chính của bạn hôm nay.</p></div><button class="btn ghost">30 ngày gần nhất⌄</button></section>
<section class="flow-section credit-section"><div class="section-title"><div><span class="flow-icon">▭</span><div><small>FLOW 1</small><h2>Thẻ tín dụng</h2></div></div><a>Đi đến dashboard →</a></div><div class="kpi-grid">@for(k of credit;track k.label){<article class="kpi"><span>{{k.icon}}</span><small>{{k.label}}</small><strong>{{k.value}}</strong><em>{{k.trend}}</em></article>}</div><div class="dashboard-grid"><article class="panel chart-panel"><header><div><h3>Chi tiêu & Cashback</h3><p>6 tháng gần nhất</p></div><span class="legend"><i></i>Chi tiêu <i></i>Cashback</span></header>@defer(on viewport){<div class="line-chart"><div class="y-labels"><span>40M</span><span>30M</span><span>20M</span><span>10M</span><span>0</span></div><svg viewBox="0 0 600 180" role="img" aria-label="Biểu đồ chi tiêu và cashback"><path class="area" d="M0 145 C80 130 100 80 180 95 S270 125 350 55 S470 90 600 25 L600 180 L0 180Z"/><path class="line" d="M0 145 C80 130 100 80 180 95 S270 125 350 55 S470 90 600 25"/><path class="cash-line" d="M0 165 C120 160 170 145 240 155 S360 145 420 135 S520 145 600 125"/></svg><div class="x-labels"><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span></div></div>}@placeholder{<div class="skeleton"></div>}</article><article class="panel"><header><div><h3>Sắp đến hạn</h3><p>7 ngày tới</p></div><a>Xem tất cả</a></header>@for(d of dues;track d.bank){<div class="due-row"><span [style.background]="d.color">{{d.bank[0]}}</span><div><b>{{d.bank}}</b><small>•••• {{d.card}} · {{d.date}}</small></div><strong>{{d.amount}}</strong></div>}</article></div></section>
<section class="flow-section invest-section"><div class="section-title"><div><span class="flow-icon">↗</span><div><small>FLOW 2</small><h2>Đầu tư website</h2></div></div><a>Đi đến dashboard →</a></div><div class="kpi-grid">@for(k of invest;track k.label){<article class="kpi"><span>{{k.icon}}</span><small>{{k.label}}</small><strong>{{k.value}}</strong><em>{{k.trend}}</em></article>}</div></section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPage {
  readonly credit: Kpi[] = [{
    label: 'Tổng chi tiêu',
    value: '42.680.000 ₫',
    trend: '↑ 8,2% tháng này',
    icon: '▭'
  }, {label: 'Dư nợ sao kê', value: '18.250.000 ₫', trend: '2 sao kê đang mở', icon: '▤'}, {
    label: 'Cashback đang chờ',
    value: '1.840.000 ₫',
    trend: '4 khoản chờ nhận',
    icon: '◇'
  }, {label: 'Cashback đã nhận', value: '5.240.000 ₫', trend: '↑ 12,4% tháng này', icon: '✓'}];
  readonly invest: Kpi[] = [{
    label: 'Available Capital',
    value: '68.400.000 ₫',
    trend: '62% tổng số dư',
    icon: '◉'
  }, {
    label: 'Locked Capital',
    value: '32.000.000 ₫',
    trend: '5 nhiệm vụ đang chạy',
    icon: '▣'
  }, {label: 'Profit đã nhận', value: '8.650.000 ₫', trend: '↑ 8,7% tháng này', icon: '↗'}, {
    label: 'Reward đã nhận',
    value: '2.180.000 ₫',
    trend: '3 khoản tháng này',
    icon: '☆'
  }];
  readonly dues = [{
    bank: 'Vietcombank',
    card: '4821',
    date: 'Hạn 24/07',
    amount: '8.450.000 ₫',
    color: '#087f5b'
  }, {bank: 'Techcombank', card: '7290', date: 'Hạn 27/07', amount: '6.800.000 ₫', color: '#dc2626'}, {
    bank: 'VPBank',
    card: '3155',
    date: 'Hạn 29/07',
    amount: '3.000.000 ₫',
    color: '#15803d'
  }];
}

