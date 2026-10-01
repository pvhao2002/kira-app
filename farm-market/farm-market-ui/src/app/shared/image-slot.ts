import {ChangeDetectionStrategy, Component, input} from '@angular/core';

/** Placeholder photo box (the mockup ships no photos): tinted by the branch theme, shows a caption. */
@Component({
  selector: 'app-image-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'[style.border-radius]': 'circle() ? "50%" : radius() + "px"', '[style.aspect-ratio]': 'ratio()'},
  template: '<span>{{ caption() }}</span>',
  styles: `
    :host {
      display: flex; align-items: center; justify-content: center; text-align: center; width: 100%;
      padding: 10px; overflow: hidden;
      background: repeating-linear-gradient(135deg, color-mix(in oklch, var(--primary) 9%, #fffdf8) 0 14px,
        color-mix(in oklch, var(--primary) 14%, #fffdf8) 14px 28px);
      color: color-mix(in oklch, var(--primary) 60%, #5a3c22); font-size: 12px; line-height: 1.3;
    }
  `
})
export class ImageSlot {
  readonly caption = input('');
  readonly radius = input(14);
  readonly circle = input(false);
  readonly ratio = input('4 / 3');
}
