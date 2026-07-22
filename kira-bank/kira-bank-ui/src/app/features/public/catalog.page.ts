import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Bank, Card, FinderResult, Mcc } from '../../shared/models/api.models';

@Component({
  selector: 'app-catalog',
  imports: [RouterLink, ReactiveFormsModule],
  template: `<header class="public-nav"><a routerLink="/" class="brand"><span class="brand-mark">K</span>Kira Bank</a><nav><a routerLink="/banks">Ngân hàng</a><a routerLink="/cards">Thẻ tín dụng</a><a routerLink="/mcc">MCC</a><a routerLink="/cashback-finder">Cashback Finder</a></nav><a routerLink="/login" class="btn primary">Đăng nhập</a></header>
  <main class="catalog"><span class="eyebrow">Dữ liệu công khai</span><h1>{{title}}</h1><p>Tra cứu minh bạch, cập nhật theo điều kiện và thời hạn hiệu lực của từng chương trình.</p><div class="search-row"><input [formControl]="search" placeholder="Tìm theo tên hoặc mã…"><button class="btn primary" (click)="load()">Tìm kiếm</button></div>
  @switch(type){@case('finder'){<section class="finder-panel"><label>Chọn MCC<select [formControl]="mccId">@for(m of mccs();track m.id){<option [value]="m.id">{{m.code}} — {{m.name}}</option>}</select></label><label>Số tiền dự kiến<input type="number" [formControl]="amount"></label><button class="btn primary" (click)="find()">So sánh cashback</button></section><div class="result-grid">@for(r of results();track r.ruleId){<article class="result-card"><span class="pill">{{r.card.cardNetwork}}</span><h2>{{r.card.cardName}}</h2><strong>{{r.estimatedCashback.toLocaleString('vi-VN')}} ₫</strong><p>{{r.rate*100}}% · Hạn mức {{r.cap?.toLocaleString('vi-VN')??'Không giới hạn'}} ₫</p><small>{{r.conditions}}</small></article>}@empty{<div class="empty">Nhập thông tin để xem thẻ phù hợp nhất.</div>}</div>}@default{<div class="catalog-grid">@for(item of items();track item.id){<article class="catalog-card"><span class="code">{{code(item)}}</span><h2>{{name(item)}}</h2><p>{{description(item)}}</p><button class="text-link">Xem chi tiết →</button></article>}@empty{<div class="empty">Không tìm thấy dữ liệu phù hợp.</div>}</div>}}</main>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  readonly type = this.route.snapshot.data['type'] as string;
  readonly title = this.type === 'banks' ? 'Danh sách ngân hàng' : this.type === 'cards' ? 'Danh mục thẻ tín dụng' : this.type === 'mcc' ? 'Tra cứu mã MCC' : 'Cashback Finder';
  readonly search = new FormControl('', { nonNullable: true });
  readonly mccId = new FormControl(1, { nonNullable: true });
  readonly amount = new FormControl(1000000, { nonNullable: true });
  readonly items = signal<(Bank | Card | Mcc)[]>([]);
  readonly mccs = signal<Mcc[]>([]);
  readonly results = signal<FinderResult[]>([]);

  constructor() {
    this.load();
    this.api.mccs().subscribe(r => { this.mccs.set(r.data); if (r.data[0]) this.mccId.setValue(r.data[0].id); });
  }
  load(): void {
    const q = this.search.value;
    if (this.type === 'banks') this.api.banks(q).subscribe(r => this.items.set(r.data));
    else if (this.type === 'cards') this.api.cards(q).subscribe(r => this.items.set(r.data));
    else this.api.mccs(q).subscribe(r => this.items.set(r.data));
  }
  find(): void { this.api.finder(this.mccId.value, this.amount.value).subscribe(r => this.results.set(r)); }
  name(i: Bank | Card | Mcc): string { return 'name' in i ? i.name : i.cardName; }
  code(i: Bank | Card | Mcc): string { return 'code' in i ? i.code : i.cardNetwork; }
  description(i: Bank | Card | Mcc): string { return i.description; }
}
