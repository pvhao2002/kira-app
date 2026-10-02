import {ChangeDetectionStrategy, Component, input} from '@angular/core';

/** Placeholder photo box (the mockup ships no photos): tinted by the branch theme, shows a caption. */
@Component({
  selector: 'app-image-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'[style.border-radius]': 'circle() ? "50%" : radius() + "px"', '[style.aspect-ratio]': 'ratio()'},
  templateUrl: './image-slot.html',
  styleUrl: './image-slot.css'
})
export class ImageSlot {
  readonly caption = input('');
  readonly radius = input(14);
  readonly circle = input(false);
  readonly ratio = input('4 / 3');
}
