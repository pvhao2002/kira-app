import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

@Component({
  selector: 'app-credit-card-preview',
  templateUrl: './credit-card-preview.html',
  styleUrl: './credit-card-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditCardPreviewComponent {
  readonly cardImage = input<string | null | undefined>('');
  readonly bankLogo = input<string | null | undefined>('');
  readonly bankName = input<string | null | undefined>('');
  readonly cardName = input<string | null | undefined>('');
  readonly cardNetwork = input<string | null | undefined>('');
  readonly cardTier = input<string | null | undefined>('');
  readonly nickname = input<string | null | undefined>('');
  readonly lastFour = input<string | null | undefined>('');
  readonly creditLimit = input<number | string | null | undefined>(null);
  readonly statementDay = input<number | string | null | undefined>(null);
  readonly dueDay = input<number | string | null | undefined>(null);
  readonly currency = input<string>('VND');

  readonly displayBank = computed(() => {
    const val = this.bankName()?.trim();
    return val ? val.toUpperCase() : 'KIRA BANK';
  });

  readonly displayCardName = computed(() => {
    const val = this.cardName()?.trim();
    return val ? val : 'Credit Card';
  });

  readonly displayNickname = computed(() => {
    const val = this.nickname()?.trim();
    return val ? val.toUpperCase() : 'CARDHOLDER NAME';
  });

  readonly displayLastFour = computed(() => {
    const val = String(this.lastFour() ?? '').trim();
    return val ? val.padStart(4, '0') : '8899';
  });

  readonly displayLimit = computed(() => {
    const limit = this.creditLimit();
    if (limit === null || limit === undefined || limit === '') return '0 ₫';
    const num = typeof limit === 'number' ? limit : parseFloat(String(limit).replaceAll(',', ''));
    if (isNaN(num)) return '0 ₫';
    const curr = this.currency() || 'VND';
    if (curr === 'VND') {
      return new Intl.NumberFormat('vi-VN').format(num) + ' ₫';
    }
    return new Intl.NumberFormat('en-US', {style: 'currency', currency: curr}).format(num);
  });

  readonly displayStatement = computed(() => {
    const val = this.statementDay();
    return val ? `${val}` : '--';
  });

  readonly displayDue = computed(() => {
    const val = this.dueDay();
    return val ? `${val}` : '--';
  });

  readonly normalizedNetwork = computed(() => {
    const net = (this.cardNetwork() || '').toUpperCase();
    if (net.includes('VISA')) return 'VISA';
    if (net.includes('MASTER')) return 'MASTERCARD';
    if (net.includes('JCB')) return 'JCB';
    if (net.includes('AMEX') || net.includes('EXPRESS')) return 'AMEX';
    if (net.includes('NAPAS')) return 'NAPAS';
    return 'GENERIC';
  });

  readonly normalizedTier = computed(() => {
    const tier = (this.cardTier() || '').toUpperCase();
    if (tier.includes('SIGNATURE')) return 'SIGNATURE';
    if (tier.includes('INFINITE')) return 'INFINITE';
    if (tier.includes('PLATINUM')) return 'PLATINUM';
    if (tier.includes('GOLD')) return 'GOLD';
    if (tier.includes('ELITE') || tier.includes('WORLD')) return 'WORLD ELITE';
    return tier ? tier : '';
  });

  readonly cardThemeClass = computed(() => {
    const tier = this.normalizedTier();
    const net = this.normalizedNetwork();

    if (tier === 'SIGNATURE' || tier === 'INFINITE') return 'theme-signature';
    if (tier === 'PLATINUM') return 'theme-platinum';
    if (tier === 'GOLD') return 'theme-gold';
    if (net === 'VISA') return 'theme-visa';
    if (net === 'MASTERCARD') return 'theme-mastercard';
    if (net === 'JCB') return 'theme-jcb';
    return 'theme-default';
  });
}
