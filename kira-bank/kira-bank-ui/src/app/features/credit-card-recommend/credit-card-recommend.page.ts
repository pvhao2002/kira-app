import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {numberFormat} from '../../core/i18n/formatters';
import {apiErrorMessage} from '../../core/services/api-error';
import {MoneyInputDirective} from '../../shared/money-input/money-input.directive';
import {IconComponent} from '../../shared/icon/icon';
import {MCC_PRESETS, MccPreset} from '../../shared/models/mcc-presets';
import {CardRecommendation, CardRecommendationResponse} from '../../shared/models/api.models';

@Component({
  selector: 'app-credit-card-recommend',
  imports: [FormsModule, RouterLink, MoneyInputDirective, IconComponent],
  templateUrl: './credit-card-recommend.page.html',
  styleUrl: './credit-card-recommend.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditCardRecommendPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);

  readonly presets = MCC_PRESETS;
  readonly presetKey = signal<string | null>(MCC_PRESETS[0].key);
  readonly mcc = signal(MCC_PRESETS[0].mcc);
  readonly amount = signal<number | null>(null);
  readonly response = signal<CardRecommendationResponse | null>(null);
  readonly loading = signal(false);
  readonly recordingCardId = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly mccValid = computed(() => /^\d{4}$/.test(this.mcc().trim()));
  readonly best = computed(() => {
    const first = this.response()?.cards[0];
    return first && !first.insufficientCredit && first.estimatedCashback > 0 ? first.cardId : null;
  });

  constructor() {
    this.search();
  }

  choosePreset(preset: MccPreset): void {
    this.presetKey.set(preset.key);
    this.mcc.set(preset.mcc);
    this.search();
  }

  changeMcc(value: string): void {
    this.mcc.set(value.replace(/\D/g, '').slice(0, 4));
    this.presetKey.set(MCC_PRESETS.find(preset => preset.mcc === this.mcc())?.key ?? null);
  }

  search(): void {
    if (!this.mccValid()) {
      this.error.set(this.i18n.t('cardRecommend.invalidMcc'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.cardRecommendations(this.mcc().trim(), this.amount()).subscribe({
      next: response => {
        this.response.set(response);
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(error, this.i18n.t('cardRecommend.error')));
      }
    });
  }

  record(card: CardRecommendation): void {
    const amount = this.amount();
    if (!amount || amount <= 0 || this.recordingCardId() !== null) return;
    this.recordingCardId.set(card.cardId);
    const preset = MCC_PRESETS.find(item => item.key === this.presetKey());
    this.api.createCardTransaction(card.cardId, {
      transactionDate: this.today(),
      description: preset ? this.i18n.t(preset.labelKey) : `MCC ${this.mcc()}`,
      amount,
      transactionType: 'SPENDING',
      mccCode: this.mcc(),
      cashbackRuleId: card.ruleId
    }, crypto.randomUUID()).subscribe({
      next: () => {
        this.recordingCardId.set(null);
        this.toast.show(this.i18n.t('cardRecommend.recorded', {card: card.nickname}), 'success');
        this.search();
      },
      error: error => {
        this.recordingCardId.set(null);
        this.error.set(apiErrorMessage(error, this.i18n.t('cardRecommend.recordError')));
      }
    });
  }

  reasonLabel(code: string): string {
    const key = `cardRecommend.reason.${code}`;
    return this.i18n.has(key) ? this.i18n.t(key) : code;
  }

  formatMoney(value: number | null, currency = 'VND'): string {
    if (value === null) return '—';
    return numberFormat(this.i18n.locale(), {
      style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2
    }).format(value);
  }

  formatRate(value: number | null): string {
    if (value === null) return '—';
    return `${numberFormat(this.i18n.locale(), {maximumFractionDigits: 2}).format(value)}%`;
  }

  /** Share of a cap already used, for the progress bar only. */
  usedPercent(remaining: number | null, cap: number | null): number {
    if (remaining === null || cap === null || cap <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((1 - remaining / cap) * 100)));
  }

  private today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
