import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';

@Component({
  selector: 'app-qty-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qty-stepper.html',
  styleUrl: './qty-stepper.css'
})
export class QtyStepper {
  readonly value = input.required<number>();
  readonly min = input(1);
  readonly changed = output<number>();
}
