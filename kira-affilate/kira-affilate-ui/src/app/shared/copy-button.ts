import {ChangeDetectionStrategy, Component, inject, input, signal} from '@angular/core';
import {ToastService} from '../core/services/toast.service';

@Component({
  selector: 'app-copy-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn btn-sm" [class.btn-primary]="primary()" [disabled]="!text()" (click)="copy()"
            [attr.aria-label]="copied() ? 'Đã sao chép' : ariaLabel() || label()" data-testid="copy-button">
      {{ copied() ? 'Đã sao chép' : label() }}
    </button>
  `
})
export class CopyButton {
  readonly text = input.required<string | null>();
  readonly label = input('Sao chép');
  readonly ariaLabel = input('');
  readonly primary = input(false);
  protected readonly copied = signal(false);
  private readonly toast = inject(ToastService);

  protected async copy(): Promise<void> {
    const text = this.text();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      window.setTimeout(() => this.copied.set(false), 1800);
    } catch {
      this.toast.show('Trình duyệt không cho phép sao chép. Hãy chọn và sao chép thủ công.', 'error');
    }
  }
}
