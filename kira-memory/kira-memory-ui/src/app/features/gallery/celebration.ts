import {Component, DestroyRef, inject, input, OnInit, output} from '@angular/core';
import {Milestone, Tier} from '../../core/since';

type Kind = 'heart' | 'petal' | 'confetti';
interface Particle { kind: Kind; style: Record<string, string>; }

/** Small: a few hearts float up. Medium: petals fall. Big: confetti and hearts. */
const EFFECTS: Record<Tier, {count: number; seconds: number; kinds: Kind[]; wish: string}> = {
  small: {count: 14, seconds: 5, kinds: ['heart'], wish: 'Thêm một tháng thương nhau ❤'},
  medium: {count: 36, seconds: 8, kinds: ['petal'], wish: 'Cảm ơn vì mình vẫn luôn bên nhau 🌸'},
  big: {count: 70, seconds: 10, kinds: ['confetti', 'confetti', 'heart'], wish: 'Chúc mừng hai đứa mình! 🎉'}
};
const COLORS = ['#e11d48', '#be123c', '#fb7185', '#f9a8d4', '#ffd6df', '#fbbf24'];

/** A milestone's effect: particles over the page that never block a click, and a card with the wish. */
@Component({
  selector: 'app-celebration',
  template: `
    <div class="sky" aria-hidden="true">
      @for (p of particles; track $index) { <i [class]="p.kind" [style]="p.style"></i> }
    </div>
    <section class="card" [class]="milestone().tier" role="status">
      <p class="title script">{{ milestone().title }}</p>
      <p class="wish">{{ wish }}</p>
      <button class="btn ghost close" type="button" (click)="closed.emit()" aria-label="Đóng lời chúc">✕</button>
    </section>
  `,
  styles: `
    .sky { position: fixed; inset: 0; z-index: 70; overflow: hidden; pointer-events: none; }
    /* Keyframe names stay literal: Angular renames component keyframes and only rewrites direct references. */
    i { position: absolute; left: var(--x); width: var(--size); height: var(--size); opacity: 0;
      animation-duration: var(--duration); animation-delay: var(--delay); animation-timing-function: ease-in;
      animation-fill-mode: forwards; }
    .heart { top: 100%; color: var(--color); font-size: var(--size); font-style: normal; line-height: 1; animation-name: rise; }
    .heart::before { content: '\\2764\\FE0E'; }
    .petal { top: -6%; border-radius: 150% 0 150% 0; background: linear-gradient(135deg, var(--color), #fff0f3); animation-name: fall; }
    .confetti { top: -6%; height: calc(var(--size) * 1.6); border-radius: 2px; background: var(--color); animation-name: fall; }
    @keyframes rise {
      10% { opacity: 1; }
      to { opacity: 0; transform: translate(var(--drift), -110vh) scale(1.3); }
    }
    @keyframes fall {
      8% { opacity: 1; }
      90% { opacity: 1; }
      to { opacity: 0; transform: translate(var(--drift), 112vh) rotate(var(--spin)); }
    }
    .card { position: fixed; top: 18px; left: 50%; z-index: 71; width: min(440px, calc(100vw - 32px)); padding: 16px 44px 16px 22px;
      background: var(--paper); border: 1px solid var(--blush); border-radius: 22px; box-shadow: var(--shadow); text-align: center;
      animation: pop .5s cubic-bezier(.2, 1.4, .4, 1) both; transform: translateX(-50%); }
    .card.big { border-color: var(--rose); }
    .title { margin: 0; font-size: 34px; line-height: 1.15; color: var(--rose-deep); }
    .big .title { font-size: 42px; }
    .wish { margin: 4px 0 0; color: var(--mauve); }
    .close { position: absolute; top: 6px; right: 6px; width: 40px; padding: 0; }
    @keyframes pop { from { opacity: 0; transform: translate(-50%, -24px) scale(.9); } }
  `
})
export class Celebration implements OnInit {
  readonly milestone = input.required<Milestone>();
  readonly closed = output<void>();
  private destroyRef = inject(DestroyRef);
  protected particles: Particle[] = [];
  protected wish = '';

  ngOnInit() {
    const effect = EFFECTS[this.milestone().tier];
    this.wish = effect.wish;
    // Reduced motion: the card alone.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.particles = Array.from({length: effect.count}, (_, i) => particle(effect.kinds[i % effect.kinds.length], effect.seconds));
    }
    const timer = setTimeout(() => this.closed.emit(), 12_000);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }
}

function particle(kind: Kind, seconds: number): Particle {
  const r = (min: number, max: number) => min + Math.random() * (max - min);
  return {kind, style: {
    '--x': `${r(0, 98)}%`, '--size': `${Math.round(r(10, kind === 'heart' ? 26 : 16))}px`,
    '--delay': `${r(0, seconds * 0.45).toFixed(2)}s`, '--duration': `${r(seconds * 0.55, seconds).toFixed(2)}s`,
    '--drift': `${Math.round(r(-90, 90))}px`, '--spin': `${Math.round(r(-540, 540))}deg`,
    '--color': COLORS[Math.floor(r(0, COLORS.length))]
  }};
}
