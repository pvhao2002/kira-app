import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {RouterLink} from '@angular/router';
import {BankCardOverviewDto, CreditCardApiService, CreditCardDto, StatementCycleDto} from '../../services/credit-card-api.service';
import {formatVnd} from '../../utils/format-vnd';

@Component({
  selector: 'app-bank-card-overview',
  imports: [RouterLink, DatePipe],
  templateUrl: './bank-card-overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankCardOverview {
  private readonly api = inject(CreditCardApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<BankCardOverviewDto | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.overview().subscribe({
      next: data => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message ?? err?.message ?? 'Không thể tải dữ liệu quản lý thẻ.');
        this.loading.set(false);
      }
    });
  }

  money(value: number | null | undefined): string {
    return formatVnd(value ?? 0);
  }

  statementFor(card: CreditCardDto): StatementCycleDto | undefined {
    return this.data()?.latestStatements.find(item => item.creditCardId === card.creditCardId);
  }

  cardStatus(card: CreditCardDto): string {
    const statement = this.statementFor(card);
    if (!statement) return 'Chưa tạo kỳ';
    return this.statementStatus(statement.status);
  }

  statementStatus(status: string): string {
    return ({
      NOT_ISSUED: 'Chưa chốt',
      UNPAID: 'Chưa thanh toán',
      PARTIALLY_PAID: 'Đã trả một phần',
      PAID: 'Đã thanh toán',
      OVERDUE: 'Quá hạn',
    } as Record<string, string>)[status] ?? status;
  }

  statusClass(status: string): string {
    if (status === 'PAID' || status === 'RECEIVED') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    if (status === 'OVERDUE' || status === 'CANCELLED') return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
    return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
  }

  cashbackStatus(status: string): string {
    return status === 'RECEIVED' ? 'Đã hoàn' : status === 'CANCELLED' ? 'Đã hủy' : 'Chờ hoàn';
  }

  initials(value: string): string {
    return value.trim().split(/\s+/).map(item => item[0]).join('').slice(0, 3).toUpperCase();
  }
}
