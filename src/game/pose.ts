// Pose representation: a flat array of joint euler angles (radians) plus pelvis offsets.
// Conventions (character faces +Z, its left is +X):
//  - limb X rotation negative = swing forward/up, positive = swing backward
//  - knee X positive = bend (shin goes back); elbow X negative = bend (forearm forward)
//  - spine/neck X positive = lean forward / look down
//  - left arm Z positive = raise out to the side, right arm Z negative = raise out to the side
//  - pelvis X -90deg = lying on back (head toward local -Z), +90deg = lying face down

export const JOINTS = [
  'pelvis',
  'spine',
  'chest',
  'neck',
  'lArm',
  'lElbow',
  'rArm',
  'rElbow',
  'lLeg',
  'lKnee',
  'rLeg',
  'rKnee',
] as const;
export type Joint = (typeof JOINTS)[number];

export const POSE_LEN = JOINTS.length * 3 + 3;
const PH = JOINTS.length * 3; // pelvis height (absolute, above root)
const PZ = PH + 1; // pelvis forward offset
const PX = PH + 2; // pelvis sideways offset

export type PoseArr = Float32Array;
type V3 = [number, number, number] | number;

export interface PoseSpec extends Partial<Record<Joint, V3>> {
  ph?: number;
  pz?: number;
  px?: number;
}

const D = Math.PI / 180;

/** Build a pose from degrees. A bare number for a joint means an X rotation. */
export function P(spec: PoseSpec): PoseArr {
  const a = new Float32Array(POSE_LEN);
  JOINTS.forEach((j, i) => {
    const v = spec[j];
    if (v === undefined) return;
    if (typeof v === 'number') a[i * 3] = v * D;
    else {
      a[i * 3] = v[0] * D;
      a[i * 3 + 1] = v[1] * D;
      a[i * 3 + 2] = v[2] * D;
    }
  });
  a[PH] = spec.ph ?? 1.0;
  a[PZ] = spec.pz ?? 0;
  a[PX] = spec.px ?? 0;
  return a;
}

/** Return a copy of base with spec's joints overriding it. */
export function mod(base: PoseArr, spec: PoseSpec): PoseArr {
  const a = new Float32Array(base);
  JOINTS.forEach((j, i) => {
    const v = spec[j];
    if (v === undefined) return;
    if (typeof v === 'number') {
      a[i * 3] = v * D;
      a[i * 3 + 1] = 0;
      a[i * 3 + 2] = 0;
    } else {
      a[i * 3] = v[0] * D;
      a[i * 3 + 1] = v[1] * D;
      a[i * 3 + 2] = v[2] * D;
    }
  });
  if (spec.ph !== undefined) a[PH] = spec.ph;
  if (spec.pz !== undefined) a[PZ] = spec.pz;
  if (spec.px !== undefined) a[PX] = spec.px;
  return a;
}

/** Mirror a pose left<->right. */
export function mirror(p: PoseArr): PoseArr {
  const a = new Float32Array(p);
  const swap = (l: Joint, r: Joint) => {
    const li = JOINTS.indexOf(l) * 3;
    const ri = JOINTS.indexOf(r) * 3;
    for (let k = 0; k < 3; k++) {
      const s = k === 0 ? 1 : -1;
      a[li + k] = p[ri + k] * s;
      a[ri + k] = p[li + k] * s;
    }
  };
  swap('lArm', 'rArm');
  swap('lElbow', 'rElbow');
  swap('lLeg', 'rLeg');
  swap('lKnee', 'rKnee');
  for (const j of ['pelvis', 'spine', 'chest', 'neck'] as Joint[]) {
    const i = JOINTS.indexOf(j) * 3;
    a[i + 1] = -p[i + 1];
    a[i + 2] = -p[i + 2];
  }
  a[PX] = -p[PX];
  return a;
}

export function lerpPose(out: PoseArr, a: PoseArr, b: PoseArr, t: number) {
  for (let i = 0; i < POSE_LEN; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

export function blendToward(cur: PoseArr, target: PoseArr, k: number) {
  for (let i = 0; i < POSE_LEN; i++) cur[i] += (target[i] - cur[i]) * k;
}

export function normalisePelvis(p: PoseArr) {
  for (let k = 0; k < 3; k++) {
    let v = p[k];
    while (v > Math.PI) v -= Math.PI * 2;
    while (v < -Math.PI) v += Math.PI * 2;
    p[k] = v;
  }
}

export const POSE_IDX = { PH, PZ, PX };

export interface Key {
  t: number;
  pose: PoseArr;
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** Sample a keyframed clip at time t (seconds). */
export function sampleKeys(keys: Key[], t: number, out: PoseArr) {
  if (t <= keys[0].t) return out.set(keys[0].pose), out;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.t) {
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return lerpPose(out, a.pose, b.pose, ease(u));
    }
  }
  out.set(keys[keys.length - 1].pose);
  return out;
}
