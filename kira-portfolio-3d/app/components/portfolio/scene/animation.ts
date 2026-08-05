export const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

export const damp = (current: number, target: number, delta: number, speed = 5) =>
  lerp(current, target, 1 - Math.exp(-speed * delta));
