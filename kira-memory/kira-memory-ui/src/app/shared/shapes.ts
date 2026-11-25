import {Shape, WidgetShape} from '../core/api';

/** Widget outlines on a 64×64 box. */
export const SHAPES: Record<Shape, {label: string; path: string}> = {
  heart: {label: 'Trái tim', path: 'M32 56S6 40 6 22a13 13 0 0 1 26-5 13 13 0 0 1 26 5c0 18-26 34-26 34z'},
  circle: {label: 'Tròn', path: 'M32 4a28 28 0 1 1 0 56 28 28 0 0 1 0-56z'},
  star: {label: 'Ngôi sao', path: 'M32 4l8.2 17.6 19.3 2.3-14.2 13.2 3.8 19.1L32 46.6l-17.1 9.6 3.8-19.1L4.5 23.9l19.3-2.3z'},
  flower: {
    label: 'Bông hoa',
    path: 'M32 6a10 10 0 0 1 10 10 10 10 0 0 1 14 9 10 10 0 0 1-4 15 10 10 0 0 1-8 13 10 10 0 0 1-12 3 10 10 0 0 1-12-3 10 10 0 0 1-8-13 10 10 0 0 1-4-15 10 10 0 0 1 14-9A10 10 0 0 1 32 6z'
  },
  cloud: {label: 'Đám mây', path: 'M18 50a12 12 0 0 1-2-23.8A15 15 0 0 1 44 20a13 13 0 0 1 4 26.6V50H18z'},
  envelope: {label: 'Phong thư', path: 'M6 16h52v34H6zM6 16l26 20 26-20'},
  bubble: {label: 'Bong bóng chat', path: 'M10 8h44a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H26L12 58V46h-2a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z'}
};

export const SHAPE_KEYS = Object.keys(SHAPES) as Shape[];

/** The shape to draw. 'auto' follows the clock minute, so both devices show the same one without talking. */
export function shapeAt(setting: WidgetShape, now: number): Shape {
  if (setting !== 'auto') return SHAPES[setting] ? setting : 'heart';
  return SHAPE_KEYS[Math.floor(now / 60_000) % SHAPE_KEYS.length];
}
