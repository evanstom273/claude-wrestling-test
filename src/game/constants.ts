// World layout. Units are roughly metres.
export const RING = {
  half: 3.0, // inside-the-ropes half width
  H: 1.0, // mat height above the arena floor
  apron: 3.4, // half width of the raised ring block
  post: 3.2, // corner post position
  ropeHeights: [0.42, 0.82, 1.22],
  floor: 7.4, // arena floor half extent wrestlers may roam
};

export const PLAY_HALF = RING.half - 0.32;

export const GRAVITY = 18;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;

export function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function approachAngle(cur: number, target: number, maxStep: number) {
  const d = wrapAngle(target - cur);
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}

export function inRingFootprint(x: number, z: number, margin = 0) {
  return Math.abs(x) < RING.apron + margin && Math.abs(z) < RING.apron + margin;
}
