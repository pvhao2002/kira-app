import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {RouterLink} from '@angular/router';
import {CreditCardApiService, MccCategoryDto} from '../../services/credit-card-api.service';
import {ToastService} from '../../config/ToastService';
import {formatVnd} from '../../utils/format-vnd';

@Component({selector: 'app-bank-card-mcc', imports: [RouterLink, DatePipe], templateUrl: './bank-card-mcc.html', changeDetection: ChangeDetectionStrategy.OnPush})
export class BankCardMcc {
  private readonly api = inject(CreditCardApiService);
  private readonly toast = inject(ToastService);
  readonly loading = signal(true);
  readonly rows = signal<MccCategoryDto[]>([]);
  readonly expandedId = signal<number | null>(null);

  constructor() { this.load(); }
  load(): void { this.loading.set(true); this.api.mccCategories(false).subscribe({next: rows => {this.rows.set(rows); this.loading.set(false);}, error: () => {this.loading.set(false); this.toast.error('Không thể tải danh mục MCC.');}}); }
  toggle(id: number): void { this.expandedId.set(this.expandedId() === id ? null : id); }
  deactivate(row: MccCategoryDto): void { if (!globalThis.confirm(`Ngừng sử dụng MCC ${row.mccCode}?`)) return; this.api.deactivateMccCategory(row.mccCategoryId).subscribe({next: () => {this.toast.success('Đã ngừng sử dụng MCC.'); this.load();}, error: err => this.toast.error(err?.error?.message ?? 'Không thể cập nhật MCC.')}); }
  money(value: number | null): string { return value == null ? 'Không giới hạn' : `${formatVnd(value)} đ`; }
}
