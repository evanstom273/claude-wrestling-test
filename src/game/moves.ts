import { mod, type PoseArr, POSE_LEN, lerpPose } from './pose';
import * as K from './poses';

// Keyframes are in the "anchor" frame: the attacker's position/facing when the move began.
// +Z is the attacker's forward, +X the attacker's left. ry is yaw in degrees relative to anchor.
export interface MKey {
  t: number;
  pose: PoseArr;
  p?: [number, number, number];
  ry?: number;
}

export interface Hit {
  t: number;
  dmg: number;
  sound: 'slam' | 'hit' | 'thud' | 'crunch';
  shake?: number;
  self?: number; // damage to attacker too
}

export type EndState = 'stand' | 'stagger' | 'gut' | 'back' | 'front' | 'sit' | 'hold';

export interface MoveDef {
  id: string;
  name: string;
  dur: number;
  atk: MKey[];
  vic: MKey[];
  hits: Hit[];
  vicEnd: EndState;
  atkEnd: EndState;
  submission?: boolean;
  excite?: number;
}

const V = (pose: PoseArr, pelvisX: number) => {
  const a = new Float32Array(pose);
  a[0] = (pelvisX * Math.PI) / 180;
  return a;
};
const ph = (pose: PoseArr, h: number) => mod(pose, { ph: h });

const HELD0: MKey = { t: 0, pose: K.HELD, p: [0, 0, 0.72], ry: 180 };
const ATK0: MKey = { t: 0, pose: K.LOCKUP };

const HEADBUTT_A = mod(K.LOCKUP, { spine: -15, neck: -30 });
const HEADBUTT_B = mod(K.LOCKUP, { spine: 38, neck: 25 });
const KNEE_A = mod(K.LOCKUP, { rLeg: -25, rKnee: 100, lKnee: 15, lLeg: [0, 0, 6] });
const KNEE_B = mod(K.LOCKUP, { spine: 30, rLeg: -95, rKnee: 70, lKnee: 15, lLeg: [0, 0, 6] });
const SLAM_DOWN = mod(K.CHOKE_SLAM, { lArm: [-70, 0, 5], lElbow: -5 });
const SUPLEX_HOLD = mod(K.ARMS_UP_HOLD, { spine: -20, lArm: [-160, 0, 10], rArm: [-150, 0, -40], rElbow: -60 });
const HIPTOSS_A = mod(K.HEADLOCK, { ph: 0.85, spine: 35, lKnee: 50, rKnee: 40 });
const DDT_DIVE = mod(K.BENT_OVER, { pelvis: [130, 0, 0], ph: 0.72, spine: 10, neck: -10, lLeg: [10, 0, 4], rLeg: [15, 0, -4], lKnee: 10, rKnee: 10 });
const KNEE_UP = mod(K.KNEEL, { spine: 0, lArm: [-60, 0, 20], rArm: [-60, 0, -20], lElbow: -60, rElbow: -60 });
const SPEAR_LAND = mod(K.PIN_COVER, { ph: 0.4 });
const DUCK = mod(K.SQUAT_LIFT, { ph: 0.72, spine: 55, neck: -30, lArm: [-40, 0, 20], rArm: [-40, 0, -20] });
const STUNNER_GRAB = mod(K.STANCE, { rArm: [-160, 0, -10], rElbow: -120, lArm: [-170, 0, 10], lElbow: -120, spine: 5 });
const STUNNER_SIT = mod(K.SIT_DOWN, { rArm: [-160, 0, -10], rElbow: -120, lArm: [-170, 0, 10], lElbow: -120 });
const NECKBREAK_SIT = mod(K.SIT_DOWN, { pelvis: [-30, 0, 0], rArm: [-120, 0, 30], rElbow: -90 });
const DANGLE_HI = mod(K.VICTIM_DANGLE, { pelvis: [-15, 0, 0], ph: 1.75 });
const ATOMIC_VIC = mod(K.SIT, { ph: 1.15, pelvis: [10, 0, 0], spine: -10, neck: -30, lArm: [0, 0, 60], rArm: [0, 0, -60], lLeg: -50, rLeg: -50 });

const backLand = (pelvis: number) => V(K.DOWN_BACK, pelvis);
const frontLand = (pelvis: number) => V(K.DOWN_FRONT, pelvis);

export const MOVES: Record<string, MoveDef> = {};
function def(m: MoveDef) {
  MOVES[m.id] = m;
}

// ---------------------------------------------------------------- quick strikes
def({
  id: 'headbutt',
  name: 'Headbutt',
  dur: 0.95,
  atk: [ATK0, { t: 0.3, pose: HEADBUTT_A }, { t: 0.42, pose: HEADBUTT_B }, { t: 0.95, pose: K.STANCE }],
  vic: [HELD0, { t: 0.42, pose: K.HELD, p: [0, 0, 0.7] }, { t: 0.55, pose: K.HURT_HIGH, p: [0, 0, 0.95] }, { t: 0.95, pose: K.HURT_HIGH, p: [0, 0, 1.2] }],
  hits: [{ t: 0.42, dmg: 5, sound: 'crunch' }],
  vicEnd: 'stagger',
  atkEnd: 'stand',
});
def({
  id: 'kneelift',
  name: 'Knee Lift',
  dur: 0.9,
  atk: [ATK0, { t: 0.28, pose: KNEE_A }, { t: 0.4, pose: KNEE_B }, { t: 0.9, pose: K.STANCE }],
  vic: [HELD0, { t: 0.4, pose: K.HELD, p: [0, 0, 0.68] }, { t: 0.52, pose: K.HURT_GUT, p: [0, 0, 0.85] }, { t: 0.9, pose: K.HURT_GUT, p: [0, 0, 1.05] }],
  hits: [{ t: 0.4, dmg: 5, sound: 'hit' }],
  vicEnd: 'gut',
  atkEnd: 'stand',
});

// ---------------------------------------------------------------- slams
def({
  id: 'bodyslam',
  name: 'Body Slam',
  dur: 1.55,
  atk: [ATK0, { t: 0.35, pose: K.SQUAT_LIFT }, { t: 0.75, pose: K.CHEST_HOLD }, { t: 0.92, pose: K.CHEST_HOLD }, { t: 1.1, pose: SLAM_DOWN }, { t: 1.55, pose: K.STANCE }],
  vic: [
    HELD0,
    { t: 0.35, pose: K.HELD, p: [0, 0, 0.5], ry: 180 },
    { t: 0.75, pose: K.HORIZONTAL_LIFT, p: [0, 0, 0.38], ry: 90 },
    { t: 0.92, pose: ph(K.HORIZONTAL_LIFT, 1.62), p: [0, 0, 0.5], ry: 90 },
    { t: 1.1, pose: K.DOWN_BACK, p: [0, 0, 0.98], ry: 90 },
  ],
  hits: [{ t: 1.1, dmg: 9, sound: 'slam', shake: 0.25 }],
  vicEnd: 'back',
  atkEnd: 'stand',
});
def({
  id: 'suplex',
  name: 'Vertical Suplex',
  dur: 2.1,
  atk: [
    ATK0,
    { t: 0.35, pose: K.HEADLOCK },
    { t: 0.75, pose: SUPLEX_HOLD },
    { t: 1.2, pose: SUPLEX_HOLD },
    { t: 1.42, pose: K.FALLING_BACK, p: [-0.25, 0, -0.1] },
    { t: 1.58, pose: K.DOWN_BACK, p: [-0.3, 0, -0.35] },
    { t: 2.1, pose: K.DOWN_BACK, p: [-0.3, 0, -0.35] },
  ],
  vic: [
    HELD0,
    { t: 0.35, pose: K.BENT_OVER, p: [0, 0, 0.78], ry: 180 },
    { t: 0.75, pose: ph(K.INVERTED, 1.95), p: [0, 0, 0.3], ry: 180 },
    { t: 1.2, pose: ph(K.INVERTED, 2.05), p: [0, 0, 0.12], ry: 180 },
    { t: 1.42, pose: ph(V(K.INVERTED, 230), 1.5), p: [0.2, 0, -0.6], ry: 180 },
    { t: 1.58, pose: backLand(270), p: [0.3, 0, -1.1], ry: 180 },
  ],
  hits: [{ t: 1.58, dmg: 11, sound: 'slam', shake: 0.3 }],
  vicEnd: 'back',
  atkEnd: 'back',
  excite: 1,
});
def({
  id: 'germansuplex',
  name: 'German Suplex',
  dur: 1.9,
  atk: [
    { t: 0, pose: K.HOLD_BEHIND },
    { t: 0.45, pose: mod(K.HOLD_BEHIND, { ph: 0.82, lKnee: 50, rKnee: 50, spine: 5 }) },
    { t: 0.8, pose: K.BRIDGE, p: [0, 0, 0.15] },
    { t: 1.25, pose: K.BRIDGE, p: [0, 0, 0.15] },
    { t: 1.5, pose: K.DOWN_BACK, p: [0, 0, 0.2] },
    { t: 1.9, pose: K.DOWN_BACK, p: [0, 0, 0.2] },
  ],
  vic: [
    { t: 0, pose: K.HELD_BEHIND, p: [0, 0, 0.55], ry: 0 },
    { t: 0.45, pose: ph(K.HELD_BEHIND, 1.2), p: [0, 0, 0.5], ry: 0 },
    { t: 0.8, pose: ph(V(K.FALLING_BACK, -90), 1.6), p: [0, 0, -0.15], ry: 0 },
    { t: 0.98, pose: ph(V(K.FALLING_BACK, -165), 0.95), p: [0, 0, -0.75], ry: 0 },
    { t: 1.3, pose: ph(V(K.FALLING_BACK, -200), 0.6), p: [0, 0, -1.2], ry: 0 },
    { t: 1.5, pose: frontLand(-270), p: [0, 0, -1.45], ry: 0 },
  ],
  hits: [{ t: 0.98, dmg: 12, sound: 'slam', shake: 0.35 }],
  vicEnd: 'front',
  atkEnd: 'back',
  excite: 1.2,
});
def({
  id: 'ddt',
  name: 'DDT',
  dur: 1.55,
  atk: [
    ATK0,
    { t: 0.35, pose: K.HEADLOCK },
    { t: 0.62, pose: mod(K.HEADLOCK, { ph: 0.9, spine: -10 }) },
    { t: 0.85, pose: mod(K.FALLING_BACK, { rArm: [-80, 30, -15], rElbow: -110 }), p: [0, 0, -0.1] },
    { t: 1.0, pose: K.DOWN_BACK, p: [0, 0, -0.45] },
    { t: 1.55, pose: K.DOWN_BACK, p: [0, 0, -0.45] },
  ],
  vic: [
    HELD0,
    { t: 0.35, pose: K.BENT_OVER, p: [0, 0, 0.85], ry: 180 },
    { t: 0.62, pose: mod(K.BENT_OVER, { ph: 0.95 }), p: [0, 0, 0.82], ry: 180 },
    { t: 1.0, pose: DDT_DIVE, p: [0.3, 0, 0.3], ry: 180 },
    { t: 1.3, pose: frontLand(90), p: [0.35, 0, 0.05], ry: 180 },
  ],
  hits: [{ t: 1.0, dmg: 13, sound: 'crunch', shake: 0.35 }],
  vicEnd: 'front',
  atkEnd: 'back',
  excite: 1.2,
});
def({
  id: 'piledriver',
  name: 'Piledriver',
  dur: 2.2,
  atk: [
    ATK0,
    { t: 0.4, pose: K.SQUAT_LIFT },
    { t: 0.95, pose: K.CHEST_HOLD },
    { t: 1.3, pose: mod(K.CHEST_HOLD, { ph: 1.0, spine: -5 }) },
    { t: 1.52, pose: K.SIT_DOWN },
    { t: 2.2, pose: K.SIT_DOWN },
  ],
  vic: [
    HELD0,
    { t: 0.4, pose: K.BENT_OVER, p: [0, 0, 0.72], ry: 180 },
    { t: 0.95, pose: ph(K.INVERTED, 1.55), p: [0, 0, 0.3], ry: 180 },
    { t: 1.3, pose: ph(K.INVERTED, 1.68), p: [0, 0, 0.3], ry: 180 },
    { t: 1.52, pose: ph(K.INVERTED, 0.98), p: [0, 0, 0.38], ry: 180 },
    { t: 1.62, pose: ph(K.INVERTED, 0.98), p: [0, 0, 0.38], ry: 180 },
    { t: 1.95, pose: frontLand(90), p: [0, 0, 0.85], ry: 180 },
  ],
  hits: [{ t: 1.52, dmg: 17, sound: 'crunch', shake: 0.5 }],
  vicEnd: 'front',
  atkEnd: 'sit',
  excite: 1.6,
});
def({
  id: 'powerbomb',
  name: 'Powerbomb',
  dur: 2.15,
  atk: [
    ATK0,
    { t: 0.4, pose: K.SQUAT_LIFT },
    { t: 0.95, pose: K.ARMS_UP_HOLD },
    { t: 1.3, pose: mod(K.ARMS_UP_HOLD, { spine: -16 }) },
    { t: 1.55, pose: SLAM_DOWN },
    { t: 2.15, pose: K.STANCE },
  ],
  vic: [
    HELD0,
    { t: 0.4, pose: K.BENT_OVER, p: [0, 0, 0.75], ry: 180 },
    { t: 0.95, pose: K.ON_SHOULDERS, p: [0, 0, 0.12], ry: 180 },
    { t: 1.3, pose: mod(K.ON_SHOULDERS, { pelvis: [-35, 0, 0], ph: 2.3 }), p: [0, 0, 0.1], ry: 180 },
    { t: 1.55, pose: K.DOWN_BACK, p: [0, 0, 1.05], ry: 180 },
  ],
  hits: [{ t: 1.55, dmg: 16, sound: 'slam', shake: 0.55 }],
  vicEnd: 'back',
  atkEnd: 'stand',
  excite: 1.6,
});
def({
  id: 'chokeslam',
  name: 'Chokeslam',
  dur: 1.85,
  atk: [
    ATK0,
    { t: 0.35, pose: mod(K.CHOKE_LIFT, { rArm: [-95, 0, -5] }) },
    { t: 0.8, pose: K.CHOKE_LIFT },
    { t: 1.12, pose: K.CHOKE_LIFT },
    { t: 1.35, pose: K.CHOKE_SLAM },
    { t: 1.85, pose: K.STANCE },
  ],
  vic: [
    HELD0,
    { t: 0.35, pose: K.VICTIM_DANGLE, p: [0, 0, 0.6], ry: 180 },
    { t: 0.8, pose: DANGLE_HI, p: [0, 0, 0.55], ry: 180 },
    { t: 1.12, pose: mod(DANGLE_HI, { ph: 1.85 }), p: [0, 0, 0.55], ry: 180 },
    { t: 1.35, pose: K.DOWN_BACK, p: [0, 0, 1.1], ry: 180 },
  ],
  hits: [{ t: 1.35, dmg: 15, sound: 'slam', shake: 0.55 }],
  vicEnd: 'back',
  atkEnd: 'stand',
  excite: 1.5,
});
def({
  id: 'spinebuster',
  name: 'Spinebuster',
  dur: 1.7,
  atk: [
    ATK0,
    { t: 0.3, pose: K.SQUAT_LIFT },
    { t: 0.6, pose: K.CHEST_HOLD, ry: 0 },
    { t: 0.78, pose: K.CHEST_HOLD, ry: 90 },
    { t: 0.95, pose: K.CHEST_HOLD, ry: 180 },
    { t: 1.12, pose: mod(K.KNEEL, { spine: 45 }), ry: 180 },
    { t: 1.7, pose: K.STANCE, ry: 180 },
  ],
  vic: [
    HELD0,
    { t: 0.3, pose: K.HELD, p: [0, 0, 0.5], ry: 180 },
    { t: 0.6, pose: mod(K.VICTIM_DANGLE, { ph: 1.4 }), p: [0, 0, 0.42], ry: 180 },
    { t: 0.78, pose: mod(K.VICTIM_DANGLE, { ph: 1.45 }), p: [0.42, 0, 0], ry: 270 },
    { t: 0.95, pose: mod(K.VICTIM_DANGLE, { ph: 1.4, pelvis: [-30, 0, 0] }), p: [0, 0, -0.42], ry: 360 },
    { t: 1.12, pose: K.DOWN_BACK, p: [0, 0, -1.05], ry: 360 },
  ],
  hits: [{ t: 1.12, dmg: 13, sound: 'slam', shake: 0.4 }],
  vicEnd: 'back',
  atkEnd: 'stand',
  excite: 1.2,
});
def({
  id: 'neckbreaker',
  name: 'Neckbreaker',
  dur: 1.4,
  atk: [ATK0, { t: 0.35, pose: K.HEADLOCK, p: [-0.4, 0, 0.35], ry: 90 }, { t: 0.62, pose: K.HEADLOCK, p: [-0.42, 0, 0.3], ry: 90 }, { t: 0.82, pose: NECKBREAK_SIT, p: [-0.45, 0, 0.05], ry: 90 }, { t: 1.4, pose: K.SIT_DOWN, p: [-0.45, 0, 0.05], ry: 90 }],
  vic: [
    HELD0,
    { t: 0.35, pose: K.HURT_HIGH, p: [0, 0, 0.62], ry: 0 },
    { t: 0.62, pose: K.FALLING_BACK, p: [0, 0, 0.5], ry: 0 },
    { t: 0.82, pose: K.DOWN_BACK, p: [0, 0, 0.0], ry: 0 },
  ],
  hits: [{ t: 0.82, dmg: 10, sound: 'slam', shake: 0.3 }],
  vicEnd: 'back',
  atkEnd: 'sit',
});
def({
  id: 'hiptoss',
  name: 'Hip Toss',
  dur: 1.15,
  atk: [ATK0, { t: 0.3, pose: K.HEADLOCK, ry: 60 }, { t: 0.55, pose: HIPTOSS_A, ry: 70 }, { t: 1.15, pose: K.STANCE, ry: 0 }],
  vic: [
    HELD0,
    { t: 0.3, pose: K.HELD, p: [0.1, 0, 0.5], ry: 200 },
    { t: 0.55, pose: mod(K.HORIZONTAL_LIFT, { ph: 1.5, pelvis: [-90, 0, 40] }), p: [0, 0, 0.45], ry: 90 },
    { t: 0.75, pose: K.DOWN_BACK, p: [0, 0, 1.0], ry: 90 },
  ],
  hits: [{ t: 0.75, dmg: 7, sound: 'slam', shake: 0.15 }],
  vicEnd: 'back',
  atkEnd: 'stand',
});
def({
  id: 'stunner',
  name: 'Stunner',
  dur: 1.7,
  atk: [ATK0, { t: 0.32, pose: STUNNER_GRAB, ry: 180, p: [0, 0, 0.05] }, { t: 0.55, pose: STUNNER_GRAB, ry: 180, p: [0, 0, 0.05] }, { t: 0.72, pose: STUNNER_SIT, ry: 180, p: [0, 0, 0.0] }, { t: 1.7, pose: K.SIT_DOWN, ry: 180 }],
  vic: [
    HELD0,
    { t: 0.32, pose: mod(K.HURT_GUT, { spine: 20 }), p: [0, 0, 0.62], ry: 180 },
    { t: 0.55, pose: mod(K.HURT_GUT, { spine: 30 }), p: [0, 0, 0.55], ry: 180 },
    { t: 0.72, pose: mod(K.HURT_GUT, { ph: 0.62, spine: 25, neck: -30, lKnee: 90, rKnee: 90, lLeg: -50, rLeg: -40 }), p: [0, 0, 0.45], ry: 180 },
    { t: 0.95, pose: ph(K.FALLING_BACK, 1.25), p: [0, 0, 0.95], ry: 180 },
    { t: 1.18, pose: K.DOWN_BACK, p: [0, 0, 1.35], ry: 180 },
  ],
  hits: [
    { t: 0.72, dmg: 12, sound: 'crunch', shake: 0.3 },
    { t: 1.18, dmg: 3, sound: 'thud', shake: 0.15 },
  ],
  vicEnd: 'back',
  atkEnd: 'sit',
  excite: 1.4,
});
def({
  id: 'atomicdrop',
  name: 'Atomic Drop',
  dur: 1.3,
  atk: [{ t: 0, pose: K.HOLD_BEHIND }, { t: 0.35, pose: K.SQUAT_LIFT }, { t: 0.62, pose: K.CHEST_HOLD }, { t: 0.82, pose: KNEE_UP }, { t: 1.3, pose: K.STANCE }],
  vic: [
    { t: 0, pose: K.HELD_BEHIND, p: [0, 0, 0.5], ry: 0 },
    { t: 0.35, pose: ph(K.HELD_BEHIND, 1.1), p: [0, 0, 0.45], ry: 0 },
    { t: 0.62, pose: ph(ATOMIC_VIC, 1.6), p: [0, 0, 0.42], ry: 0 },
    { t: 0.82, pose: ATOMIC_VIC, p: [0, 0, 0.5], ry: 0 },
    { t: 1.05, pose: mod(K.HURT_HIGH, { spine: -30 }), p: [0, 0, 0.85], ry: 0 },
    { t: 1.3, pose: K.HURT_HIGH, p: [0, 0, 1.05], ry: 0 },
  ],
  hits: [{ t: 0.82, dmg: 7, sound: 'crunch', shake: 0.15 }],
  vicEnd: 'stagger',
  atkEnd: 'stand',
});

// ---------------------------------------------------------------- running / counters
def({
  id: 'spear',
  name: 'Spear',
  dur: 1.15,
  atk: [{ t: 0, pose: K.SPEAR }, { t: 0.28, pose: K.FALLING_FRONT, p: [0, 0, 0.75] }, { t: 0.45, pose: SPEAR_LAND, p: [0, 0, 1.15] }, { t: 1.15, pose: SPEAR_LAND, p: [0, 0, 1.15] }],
  vic: [{ t: 0, pose: K.HURT_GUT, p: [0, 0, 0.7], ry: 180 }, { t: 0.28, pose: K.FALLING_BACK, p: [0, 0, 1.25], ry: 180 }, { t: 0.45, pose: K.DOWN_BACK, p: [0, 0, 1.6], ry: 180 }],
  hits: [
    { t: 0.06, dmg: 6, sound: 'hit' },
    { t: 0.45, dmg: 9, sound: 'slam', shake: 0.4 },
  ],
  vicEnd: 'back',
  atkEnd: 'front',
  excite: 1.3,
});
def({
  id: 'bulldog',
  name: 'Bulldog',
  dur: 1.2,
  atk: [{ t: 0, pose: mod(K.RUN_A, { rArm: [-90, 30, -15], rElbow: -110 }) }, { t: 0.3, pose: mod(K.FALLING_FRONT, { ph: 0.6 }), p: [0.3, 0, 0.7] }, { t: 0.45, pose: K.SIT_DOWN, p: [0.35, 0, 1.0] }, { t: 1.2, pose: K.SIT_DOWN, p: [0.35, 0, 1.0] }],
  vic: [{ t: 0, pose: K.HURT_HIGH, p: [0, 0, 0.75], ry: 0 }, { t: 0.3, pose: K.FALLING_FRONT, p: [0, 0, 0.95], ry: 0 }, { t: 0.45, pose: K.DOWN_FRONT, p: [0, 0, 1.25], ry: 0 }],
  hits: [{ t: 0.45, dmg: 11, sound: 'crunch', shake: 0.3 }],
  vicEnd: 'front',
  atkEnd: 'sit',
  excite: 1.1,
});
def({
  id: 'backbodydrop',
  name: 'Back Body Drop',
  dur: 1.2,
  atk: [{ t: 0, pose: DUCK }, { t: 0.2, pose: DUCK }, { t: 0.42, pose: K.ARMS_UP_HOLD }, { t: 1.2, pose: K.STANCE }],
  vic: [
    { t: 0, pose: K.RUN_A, p: [0, 0, 0.9], ry: 180 },
    { t: 0.2, pose: mod(K.HURT_GUT, { ph: 1.0 }), p: [0, 0, 0.45], ry: 180 },
    { t: 0.38, pose: ph(V(K.FALLING_FRONT, 110), 1.7), p: [0, 0, 0.0], ry: 180 },
    { t: 0.55, pose: ph(V(K.INVERTED, 200), 1.9), p: [0, 0, -0.65], ry: 180 },
    { t: 0.72, pose: backLand(270), p: [0, 0, -1.4], ry: 180 },
  ],
  hits: [{ t: 0.72, dmg: 10, sound: 'slam', shake: 0.35 }],
  vicEnd: 'back',
  atkEnd: 'stand',
  excite: 1.1,
});
def({
  id: 'powerslam',
  name: 'Powerslam',
  dur: 1.35,
  atk: [{ t: 0, pose: DUCK }, { t: 0.3, pose: K.CHEST_HOLD }, { t: 0.55, pose: K.FALLING_FRONT, p: [0, 0, 0.35] }, { t: 0.7, pose: K.PIN_COVER, p: [0, 0, 0.45] }, { t: 1.35, pose: K.PIN_COVER, p: [0, 0, 0.45] }],
  vic: [
    { t: 0, pose: K.RUN_A, p: [0, 0, 0.85], ry: 180 },
    { t: 0.3, pose: K.HORIZONTAL_LIFT, p: [0, 0, 0.36], ry: 90 },
    { t: 0.55, pose: ph(K.HORIZONTAL_LIFT, 1.0), p: [0, 0, 0.6], ry: 90 },
    { t: 0.7, pose: K.DOWN_BACK, p: [0, 0, 0.9], ry: 90 },
  ],
  hits: [{ t: 0.7, dmg: 12, sound: 'slam', shake: 0.45 }],
  vicEnd: 'back',
  atkEnd: 'front',
  excite: 1.2,
});

// ---------------------------------------------------------------- picking up a downed opponent
def({
  id: 'pickup',
  name: 'Pick Up',
  dur: 0.8,
  atk: [{ t: 0, pose: mod(K.SQUAT_LIFT, { ph: 0.8 }) }, { t: 0.45, pose: K.SQUAT_LIFT }, { t: 0.8, pose: K.LOCKUP }],
  vic: [{ t: 0, pose: K.SIT, p: [0, 0, 0.75], ry: 180 }, { t: 0.4, pose: K.KNEEL, p: [0, 0, 0.75], ry: 180 }, { t: 0.8, pose: K.HELD, p: [0, 0, 0.72], ry: 180 }],
  hits: [],
  vicEnd: 'hold',
  atkEnd: 'hold',
});

// ---------------------------------------------------------------- submissions (looped hold after the last key)
def({
  id: 'bostoncrab',
  name: 'Boston Crab',
  dur: 0.9,
  submission: true,
  atk: [{ t: 0, pose: K.SQUAT_LIFT }, { t: 0.5, pose: mod(K.CRAB_ATK, { spine: 10 }) }, { t: 0.9, pose: K.CRAB_ATK }],
  vic: [{ t: 0, pose: K.DOWN_FRONT, p: [0, 0, 1.0], ry: 0 }, { t: 0.5, pose: mod(K.CRAB_VIC, { spine: -5 }), p: [0, 0, 0.92], ry: 0 }, { t: 0.9, pose: K.CRAB_VIC, p: [0, 0, 0.85], ry: 0 }],
  hits: [],
  vicEnd: 'front',
  atkEnd: 'stand',
});
def({
  id: 'camelclutch',
  name: 'Camel Clutch',
  dur: 0.9,
  submission: true,
  atk: [{ t: 0, pose: K.SQUAT_LIFT, p: [0, 0, 0] }, { t: 0.5, pose: mod(K.CAMEL_ATK, { spine: 10, ph: 0.55 }), p: [0, 0, 0.35] }, { t: 0.9, pose: K.CAMEL_ATK, p: [0, 0, 0.35] }],
  vic: [{ t: 0, pose: K.DOWN_FRONT, p: [0, 0, 0.55], ry: 0 }, { t: 0.5, pose: K.DOWN_FRONT, p: [0, 0, 0.55], ry: 0 }, { t: 0.9, pose: K.CAMEL_VIC, p: [0, 0, 0.55], ry: 0 }],
  hits: [],
  vicEnd: 'front',
  atkEnd: 'stand',
});
def({
  id: 'leglock',
  name: 'Leg Lock',
  dur: 0.9,
  submission: true,
  atk: [{ t: 0, pose: K.SQUAT_LIFT }, { t: 0.5, pose: K.SIT_DOWN }, { t: 0.9, pose: K.LEGLOCK_ATK }],
  vic: [{ t: 0, pose: K.DOWN_BACK, p: [0, 0, 1.15], ry: 180 }, { t: 0.5, pose: K.DOWN_BACK, p: [0, 0, 1.1], ry: 180 }, { t: 0.9, pose: K.LEGLOCK_VIC, p: [0, 0, 1.05], ry: 180 }],
  hits: [],
  vicEnd: 'back',
  atkEnd: 'sit',
});

// ---------------------------------------------------------------- sampling
export interface Sample {
  pose: PoseArr;
  p: [number, number, number];
  ry: number;
}

const ease = (t: number) => t * t * (3 - 2 * t);

export function sampleMove(keys: MKey[], t: number, out: Sample) {
  let a = keys[0];
  let b = keys[0];
  let u = 0;
  if (t > keys[0].t) {
    a = keys[keys.length - 1];
    b = a;
    for (let i = 0; i < keys.length - 1; i++) {
      if (t <= keys[i + 1].t) {
        a = keys[i];
        b = keys[i + 1];
        u = ease((t - a.t) / Math.max(1e-6, b.t - a.t));
        break;
      }
    }
  }
  lerpPose(out.pose, a.pose, b.pose, u);
  const pa = resolveP(keys, a);
  const pb = resolveP(keys, b);
  out.p[0] = pa[0] + (pb[0] - pa[0]) * u;
  out.p[1] = pa[1] + (pb[1] - pa[1]) * u;
  out.p[2] = pa[2] + (pb[2] - pa[2]) * u;
  const ra = resolveR(keys, a);
  const rb = resolveR(keys, b);
  out.ry = ((ra + (rb - ra) * u) * Math.PI) / 180;
  return out;
}

function resolveP(keys: MKey[], k: MKey): [number, number, number] {
  if (k.p) return k.p;
  for (let i = keys.indexOf(k); i >= 0; i--) if (keys[i].p) return keys[i].p!;
  return [0, 0, 0];
}
function resolveR(keys: MKey[], k: MKey): number {
  if (k.ry !== undefined) return k.ry;
  for (let i = keys.indexOf(k); i >= 0; i--) if (keys[i].ry !== undefined) return keys[i].ry!;
  return 0;
}

export function newSample(): Sample {
  return { pose: new Float32Array(POSE_LEN), p: [0, 0, 0], ry: 0 };
}
