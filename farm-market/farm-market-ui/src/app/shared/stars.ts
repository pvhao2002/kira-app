import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

@Component({
  selector: 'app-stars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span class="s" [attr.aria-label]="value() + \' trên 5 sao\'">{{ text() }}</span>',
  styles: '.s { color: var(--star); letter-spacing: 1px; }'
})
export class Stars {
  readonly value = input.required<number>();
  readonly text = computed(() => '★'.repeat(Math.round(this.value())) + '☆'.repeat(5 - Math.round(this.value())));
}
