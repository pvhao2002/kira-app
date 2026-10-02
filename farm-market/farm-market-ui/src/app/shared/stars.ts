import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

@Component({
  selector: 'app-stars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stars.html',
  styleUrl: './stars.css'
})
export class Stars {
  readonly value = input.required<number>();
  readonly text = computed(() => '★'.repeat(Math.round(this.value())) + '☆'.repeat(5 - Math.round(this.value())));
}
