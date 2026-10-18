import { P, mod, mirror, type PoseArr } from './pose';

// ---- Standing ---------------------------------------------------------------
export const STAND = P({
  lArm: [0, 0, 10],
  rArm: [0, 0, -10],
  lElbow: -12,
  rElbow: -12,
  lLeg: [-2, 0, 3],
  rLeg: [-2, 0, -3],
  lKnee: 5,
  rKnee: 5,
});

export const STANCE = P({
  ph: 0.95,
  spine: 10,
  neck: -6,
  lArm: [-45, 0, 22],
  rArm: [-35, 0, -22],
  lElbow: -95,
  rElbow: -105,
  lLeg: [-22, 0, 6],
  lKnee: 28,
  rLeg: [10, 0, -6],
  rKnee: 22,
});

// ---- Locomotion (procedurally blended, these are extremes) -------------------
export const WALK_A = P({
  ph: 0.98,
  spine: 6,
  lArm: [25, 0, 10],
  rArm: [-25, 0, -10],
  lElbow: -20,
  rElbow: -30,
  lLeg: -28,
  lKnee: 8,
  rLeg: 18,
  rKnee: 30,
});
export const WALK_B = mirror(WALK_A);

export const RUN_A = P({
  ph: 0.93,
  spine: 22,
  neck: -14,
  lArm: [45, 0, 12],
  rArm: [-60, 0, -12],
  lElbow: -70,
  rElbow: -95,
  lLeg: -60,
  lKnee: 35,
  rLeg: 30,
  rKnee: 85,
});
export const RUN_B = mirror(RUN_A);

// ---- Strikes ---------------------------------------------------------------
export const PUNCH_WIND = mod(STANCE, {
  spine: [8, -22, 0],
  rArm: [-40, 0, -40],
  rElbow: -120,
});
export const PUNCH_HIT = mod(STANCE, {
  spine: [12, 30, 0],
  rArm: [-88, 0, -6],
  rElbow: -5,
  lArm: [-30, 0, 30],
  lElbow: -110,
  lLeg: [-30, 0, 4],
  lKnee: 35,
  rLeg: [18, 0, -4],
});

export const FOREARM_WIND = mod(STANCE, {
  spine: [-6, -35, 0],
  rArm: [-60, 0, -80],
  rElbow: -110,
});
export const FOREARM_HIT = mod(STANCE, {
  spine: [18, 35, 0],
  rArm: [-95, 0, 20],
  rElbow: -85,
  lLeg: [-35, 0, 4],
  lKnee: 40,
});

export const KICK_WIND = mod(STANCE, {
  ph: 0.98,
  spine: -5,
  rLeg: [-40, 0, 0],
  rKnee: 95,
  lKnee: 10,
  lLeg: [0, 0, 4],
});
export const KICK_HIT = mod(STANCE, {
  ph: 0.98,
  spine: -18,
  neck: 10,
  rLeg: [-95, 0, 0],
  rKnee: 0,
  lLeg: [0, 0, 4],
  lKnee: 5,
  lArm: [-20, 0, 40],
  rArm: [10, 0, -40],
});

export const HEADBUTT_WIND = mod(STANCE, { spine: -18, neck: -25 });
export const HEADBUTT_HIT = mod(STANCE, { spine: 30, neck: 20 });

export const STOMP_WIND = mod(STAND, {
  spine: 10,
  neck: 30,
  rLeg: -60,
  rKnee: 80,
  lArm: [0, 0, 30],
  rArm: [0, 0, -30],
});
export const STOMP_HIT = mod(STAND, {
  spine: 18,
  neck: 35,
  rLeg: -20,
  rKnee: 25,
  lKnee: 15,
  ph: 0.97,
  lArm: [0, 0, 25],
  rArm: [0, 0, -25],
});

export const CLOTHESLINE = mod(RUN_A, {
  spine: [5, 10, 0],
  rArm: [-10, 0, -88],
  rElbow: 0,
  lArm: [0, 0, 30],
  lElbow: -40,
});

export const SHOULDER_BLOCK = mod(RUN_A, {
  spine: [40, 20, 0],
  neck: -10,
  rArm: [-10, 0, -10],
  rElbow: -90,
  lArm: [-20, 0, 20],
  lElbow: -90,
});

export const DROPKICK_AIR = P({
  ph: 1.15,
  pelvis: [-80, 0, 0],
  spine: 20,
  neck: 30,
  lLeg: -95,
  rLeg: -95,
  lKnee: 0,
  rKnee: 0,
  lArm: [0, 0, 60],
  rArm: [0, 0, -60],
});

export const SPEAR = P({
  ph: 0.7,
  pelvis: [55, 0, 0],
  spine: 20,
  neck: -40,
  lArm: [-80, 0, 20],
  rArm: [-80, 0, -20],
  lElbow: -30,
  rElbow: -30,
  lLeg: [10, 0, 0],
  lKnee: 30,
  rLeg: [40, 0, 0],
  rKnee: 20,
});

// ---- Reactions -------------------------------------------------------------
export const HURT_HIGH = mod(STAND, {
  spine: -22,
  neck: -30,
  lArm: [20, 0, 40],
  rArm: [20, 0, -40],
  lElbow: -30,
  rElbow: -30,
  lLeg: [-20, 0, 4],
  lKnee: 25,
  ph: 0.97,
});
export const HURT_GUT = P({
  ph: 0.88,
  pelvis: [10, 0, 0],
  spine: 42,
  chest: 10,
  neck: -15,
  lArm: [-45, 0, 8],
  rArm: [-45, 0, -8],
  lElbow: -100,
  rElbow: -100,
  lLeg: [-30, 0, 5],
  lKnee: 45,
  rLeg: [-15, 0, -5],
  rKnee: 40,
});
export const DIZZY = mod(STAND, {
  spine: [8, 0, 8],
  neck: [20, 0, -15],
  lArm: [5, 0, 15],
  rArm: [5, 0, -15],
  lKnee: 15,
  rKnee: 15,
  ph: 0.97,
});

// Lying down
export const DOWN_BACK = P({
  ph: 0.14,
  pelvis: [-90, 0, 0],
  spine: -2,
  neck: -8,
  lArm: [10, 0, 55],
  rArm: [10, 0, -55],
  lElbow: -25,
  rElbow: -15,
  lLeg: [-6, 0, 10],
  rLeg: [-14, 0, -6],
  lKnee: 6,
  rKnee: 30,
});
export const DOWN_FRONT = P({
  ph: 0.14,
  pelvis: [90, 0, 0],
  spine: 0,
  neck: -40,
  lArm: [-20, 0, 50],
  rArm: [-30, 0, -40],
  lElbow: -60,
  rElbow: -80,
  lLeg: [4, 0, 8],
  rLeg: [4, 0, -6],
  lKnee: 10,
  rKnee: 20,
});
// Down but writhing (mixed in when hurt)
export const DOWN_BACK_WRITHE = mod(DOWN_BACK, {
  spine: 8,
  neck: 10,
  lArm: [-50, 0, 30],
  lElbow: -100,
  rKnee: 60,
  rLeg: -30,
});

// Get-up sequence (from back)
export const SIT = P({
  ph: 0.2,
  pelvis: [-20, 0, 0],
  spine: 25,
  neck: 10,
  lArm: [20, 0, 20],
  rArm: [20, 0, -20],
  lElbow: -10,
  rElbow: -10,
  lLeg: -70,
  rLeg: -70,
  lKnee: 15,
  rKnee: 35,
});
export const KNEEL = P({
  ph: 0.55,
  pelvis: [5, 0, 0],
  spine: 25,
  neck: -5,
  lArm: [-20, 0, 15],
  rArm: [-10, 0, -15],
  lElbow: -40,
  rElbow: -30,
  lLeg: -80,
  lKnee: 85,
  rLeg: [15, 0, 0],
  rKnee: 105,
});
export const PUSHUP = P({
  ph: 0.38,
  pelvis: [70, 0, 0],
  spine: -10,
  neck: -40,
  lArm: [-75, 0, 10],
  rArm: [-75, 0, -10],
  lElbow: -10,
  rElbow: -10,
  lLeg: 10,
  rLeg: 10,
  lKnee: 60,
  rKnee: 60,
});
export const ALL_FOURS = P({
  ph: 0.5,
  pelvis: [55, 0, 0],
  spine: 15,
  neck: -40,
  lArm: [-70, 0, 8],
  rArm: [-70, 0, -8],
  lLeg: -50,
  lKnee: 120,
  rLeg: -50,
  rKnee: 120,
});

// ---- Grappling ---------------------------------------------------------------
export const LOCKUP = P({
  ph: 0.93,
  spine: 22,
  neck: -10,
  lArm: [-80, 0, 15],
  rArm: [-75, 0, -15],
  lElbow: -55,
  rElbow: -45,
  lLeg: [-28, 0, 6],
  lKnee: 30,
  rLeg: [20, 0, -6],
  rKnee: 18,
});
export const HELD = mod(LOCKUP, { spine: 25, neck: -5, lArm: [-60, 0, 25], rArm: [-55, 0, -25], lElbow: -70, rElbow: -70 });
export const HOLD_BEHIND = P({
  ph: 0.92,
  spine: 12,
  lArm: [-65, 0, 35],
  rArm: [-65, 0, -35],
  lElbow: -80,
  rElbow: -80,
  lLeg: [-20, 0, 8],
  lKnee: 30,
  rLeg: [15, 0, -8],
  rKnee: 25,
});
export const HELD_BEHIND = mod(STAND, {
  spine: -5,
  neck: -10,
  lArm: [-10, 0, 25],
  rArm: [-10, 0, -25],
  lElbow: -60,
  rElbow: -60,
  lKnee: 15,
  rKnee: 15,
  ph: 0.97,
});
export const SQUAT_LIFT = P({
  ph: 0.78,
  spine: 30,
  neck: -20,
  lArm: [-70, 0, 15],
  rArm: [-70, 0, -15],
  lElbow: -40,
  rElbow: -40,
  lLeg: [-60, 0, 10],
  rLeg: [-60, 0, -10],
  lKnee: 90,
  rKnee: 90,
});
export const ARMS_UP_HOLD = P({
  ph: 1.0,
  spine: -10,
  neck: -10,
  lArm: [-170, 0, 15],
  rArm: [-170, 0, -15],
  lElbow: -20,
  rElbow: -20,
  lLeg: [-18, 0, 8],
  rLeg: [10, 0, -8],
  lKnee: 10,
  rKnee: 8,
});
export const CHEST_HOLD = P({
  ph: 0.98,
  spine: -12,
  lArm: [-80, 0, 0],
  rArm: [-80, 0, 0],
  lElbow: -70,
  rElbow: -70,
  lLeg: [-15, 0, 8],
  rLeg: [10, 0, -8],
  lKnee: 10,
  rKnee: 10,
});
export const CHOKE_LIFT = P({
  ph: 1.0,
  spine: -8,
  rArm: [-150, 0, -5],
  rElbow: -10,
  lArm: [-30, 0, 30],
  lElbow: -60,
  lLeg: [-15, 0, 8],
  rLeg: [10, 0, -8],
  lKnee: 8,
  rKnee: 8,
});
export const CHOKE_SLAM = P({
  ph: 0.7,
  spine: 50,
  neck: 20,
  rArm: [-70, 0, -5],
  rElbow: -5,
  lArm: [-10, 0, 30],
  lElbow: -40,
  lLeg: [-60, 0, 8],
  rLeg: [10, 0, -8],
  lKnee: 70,
  rKnee: 60,
});
export const VICTIM_DANGLE = P({
  ph: 1.0,
  spine: -10,
  neck: -25,
  lArm: [-60, 0, 10],
  rArm: [-60, 0, -10],
  lElbow: -90,
  rElbow: -90,
  lLeg: [-15, 0, 4],
  rLeg: [5, 0, -4],
  lKnee: 25,
  rKnee: 35,
});
export const BRIDGE = P({
  ph: 0.55,
  pelvis: [-75, 0, 0],
  spine: -45,
  neck: -40,
  lArm: [-160, 0, 15],
  rArm: [-160, 0, -15],
  lElbow: -10,
  rElbow: -10,
  lLeg: [-10, 0, 8],
  rLeg: [-10, 0, -8],
  lKnee: 70,
  rKnee: 70,
});
export const SIT_DOWN = P({
  ph: 0.22,
  pelvis: [-10, 0, 0],
  spine: 5,
  lArm: [-60, 0, 10],
  rArm: [-60, 0, -10],
  lElbow: -60,
  rElbow: -60,
  lLeg: -85,
  rLeg: -85,
  lKnee: 15,
  rKnee: 15,
});
export const SIT_DOWN_ARMS_UP = mod(SIT_DOWN, { lArm: [-150, 0, 20], rArm: [-150, 0, -20], lElbow: -10, rElbow: -10 });
export const HEADLOCK = P({
  ph: 0.92,
  spine: 15,
  lArm: [-60, 0, 0],
  rArm: [-80, 30, -15],
  lElbow: -80,
  rElbow: -110,
  lLeg: [-20, 0, 8],
  rLeg: [15, 0, -8],
  lKnee: 25,
  rKnee: 20,
});
export const BENT_OVER = P({
  ph: 0.85,
  pelvis: [15, 0, 0],
  spine: 60,
  neck: 10,
  lArm: [-20, 0, 15],
  rArm: [-20, 0, -15],
  lElbow: -30,
  rElbow: -30,
  lLeg: [-25, 0, 6],
  rLeg: [-10, 0, -6],
  lKnee: 30,
  rKnee: 25,
});
export const INVERTED = P({
  ph: 1.6,
  pelvis: [180, 0, 0],
  spine: 0,
  neck: 10,
  lArm: [-30, 0, 20],
  rArm: [-30, 0, -20],
  lElbow: -60,
  rElbow: -60,
  lLeg: [-5, 0, 4],
  rLeg: [-5, 0, -4],
  lKnee: 10,
  rKnee: 10,
});
export const ON_SHOULDERS = P({
  ph: 2.15,
  pelvis: [-20, 0, 0],
  spine: -15,
  neck: 10,
  lArm: [-40, 0, 30],
  rArm: [-40, 0, -30],
  lElbow: -40,
  rElbow: -40,
  lLeg: [-100, 0, 25],
  rLeg: [-100, 0, -25],
  lKnee: 80,
  rKnee: 80,
});
export const HORIZONTAL_LIFT = mod(DOWN_BACK, {
  ph: 1.45,
  lArm: [0, 0, 40],
  rArm: [0, 0, -40],
  lKnee: 30,
  rKnee: 30,
  neck: -20,
});
export const FALLING_BACK = P({
  ph: 0.75,
  pelvis: [-45, 0, 0],
  spine: 10,
  neck: 20,
  lArm: [-50, 0, 40],
  rArm: [-50, 0, -40],
  lElbow: -30,
  rElbow: -30,
  lLeg: -30,
  rLeg: -40,
  lKnee: 20,
  rKnee: 20,
});
export const FALLING_FRONT = P({
  ph: 0.75,
  pelvis: [45, 0, 0],
  spine: 5,
  neck: -30,
  lArm: [-80, 0, 30],
  rArm: [-80, 0, -30],
  lElbow: -20,
  rElbow: -20,
  lLeg: 15,
  rLeg: 10,
  lKnee: 10,
  rKnee: 10,
});
export const AIRBORNE_FLAT = P({
  ph: 0.2,
  pelvis: [90, 0, 0],
  spine: -10,
  neck: -40,
  lArm: [-150, 0, 40],
  rArm: [-150, 0, -40],
  lElbow: -10,
  rElbow: -10,
  lLeg: [15, 0, 8],
  rLeg: [15, 0, -8],
  lKnee: 15,
  rKnee: 15,
});
export const ELBOW_DROP = P({
  ph: 0.3,
  pelvis: [90, 0, 0],
  spine: 0,
  neck: -40,
  rArm: [-20, 0, -80],
  rElbow: -150,
  lArm: [-150, 0, 40],
  lElbow: -20,
  lLeg: [10, 0, 8],
  rLeg: [10, 0, -8],
});
export const LEG_DROP = P({
  ph: 0.25,
  pelvis: [-70, 0, 0],
  spine: 10,
  lLeg: [-5, 0, 0],
  rLeg: [-60, 0, 0],
  lKnee: 0,
  rKnee: 0,
  lArm: [-30, 0, 60],
  rArm: [-30, 0, -60],
});

// Pin cover: lying across opponent, face down, slightly raised
export const PIN_COVER = P({
  ph: 0.36,
  pelvis: [88, 0, 0],
  spine: 4,
  neck: -20,
  lArm: [-100, 0, 30],
  rArm: [-60, 0, -40],
  lElbow: -40,
  rElbow: -20,
  lLeg: [10, 0, 15],
  rLeg: [5, 0, -12],
  lKnee: 30,
  rKnee: 70,
});
export const PINNED = mod(DOWN_BACK, { lArm: [0, 0, 70], rArm: [0, 0, -70], lElbow: 0, rElbow: 0 });
export const KICKOUT = mod(DOWN_BACK, { spine: 30, neck: 20, lArm: [-60, 0, 30], rArm: [-60, 0, -30], lLeg: -40, rLeg: -40 });

// Submissions
export const CRAB_ATK = P({
  ph: 0.8,
  spine: -25,
  neck: -10,
  lArm: [-50, 0, 20],
  rArm: [-50, 0, -20],
  lElbow: -80,
  rElbow: -80,
  lLeg: [-35, 0, 20],
  rLeg: [-35, 0, -20],
  lKnee: 60,
  rKnee: 60,
});
export const CRAB_VIC = mod(DOWN_FRONT, {
  spine: -35,
  neck: -40,
  lArm: [-150, 0, 20],
  rArm: [-130, 0, -20],
  lElbow: -10,
  rElbow: -40,
  lLeg: [70, 0, 5],
  rLeg: [70, 0, -5],
  lKnee: 5,
  rKnee: 5,
});
export const CAMEL_ATK = P({
  ph: 0.5,
  spine: -30,
  neck: -10,
  lArm: [-60, 0, 10],
  rArm: [-60, 0, -10],
  lElbow: -60,
  rElbow: -60,
  lLeg: [-80, 0, 50],
  rLeg: [-80, 0, -50],
  lKnee: 120,
  rKnee: 120,
});
export const CAMEL_VIC = mod(DOWN_FRONT, {
  spine: -50,
  neck: -40,
  lArm: [-150, 0, 10],
  rArm: [-150, 0, -10],
  lElbow: -20,
  rElbow: -20,
});
export const LEGLOCK_ATK = P({
  ph: 0.2,
  pelvis: [-40, 0, 0],
  spine: -20,
  lArm: [-80, 0, 20],
  rArm: [-80, 0, -20],
  lElbow: -60,
  rElbow: -60,
  lLeg: [-60, 0, 30],
  rLeg: [-60, 0, -30],
  lKnee: 60,
  rKnee: 60,
});
export const LEGLOCK_VIC = mod(DOWN_BACK, {
  spine: 25,
  neck: 20,
  lArm: [-40, 0, 40],
  rArm: [-60, 0, -40],
  lLeg: [-50, 0, 0],
  rLeg: [-20, 0, 0],
  rKnee: 10,
});

// ---- Misc ------------------------------------------------------------------
export const TAUNT_FLEX = P({
  ph: 0.98,
  spine: -8,
  neck: -15,
  lArm: [0, 0, 90],
  rArm: [0, 0, -90],
  lElbow: [-120, 0, 0],
  rElbow: [-120, 0, 0],
  lLeg: [-5, 0, 12],
  rLeg: [-5, 0, -12],
  lKnee: 8,
  rKnee: 8,
});
export const TAUNT_FLEX2 = mod(TAUNT_FLEX, { lArm: [0, -30, 95], rArm: [0, 30, -95], lElbow: -135, rElbow: -135, spine: [5, 0, 0] });
export const TAUNT_POINT = P({
  ph: 1.0,
  spine: -5,
  neck: -10,
  rArm: [-160, 0, -20],
  rElbow: 0,
  lArm: [0, 0, 20],
  lElbow: -80,
  lLeg: [-5, 0, 10],
  rLeg: [-5, 0, -10],
});
export const TAUNT_CROWD = P({
  ph: 0.99,
  spine: -12,
  neck: -20,
  lArm: [-40, 0, 130],
  rArm: [-40, 0, -130],
  lElbow: -10,
  rElbow: -10,
  lLeg: [-5, 0, 10],
  rLeg: [-5, 0, -10],
});
export const VICTORY = P({
  ph: 1.0,
  spine: -10,
  neck: -25,
  lArm: [-170, 0, 25],
  rArm: [-170, 0, -25],
  lElbow: -5,
  rElbow: -5,
  lLeg: [-5, 0, 10],
  rLeg: [-5, 0, -10],
});
export const CLIMB = P({
  ph: 0.95,
  spine: 5,
  lArm: [-130, 0, 20],
  rArm: [-110, 0, -20],
  lElbow: -40,
  rElbow: -40,
  lLeg: -80,
  lKnee: 90,
  rLeg: [-10, 0, 0],
  rKnee: 20,
});
export const PERCHED = P({
  ph: 0.75,
  spine: 20,
  neck: -20,
  lArm: [-30, 0, 50],
  rArm: [-30, 0, -50],
  lElbow: -20,
  rElbow: -20,
  lLeg: [-60, 0, 15],
  rLeg: [-60, 0, -15],
  lKnee: 90,
  rKnee: 90,
});
export const PERCHED_TAUNT = mod(PERCHED, { ph: 0.95, spine: -10, lLeg: [-10, 0, 15], rLeg: [-10, 0, -15], lKnee: 15, rKnee: 15, lArm: [-160, 0, 25], rArm: [-160, 0, -25] });
export const DIVE_SPREAD = P({
  ph: 0.2,
  pelvis: [80, 0, 0],
  spine: -15,
  neck: -40,
  lArm: [-10, 0, 90],
  rArm: [-10, 0, -90],
  lLeg: [10, 0, 15],
  rLeg: [10, 0, -15],
  lKnee: 10,
  rKnee: 10,
});
export const THROUGH_ROPES = P({
  ph: 0.62,
  pelvis: [30, 0, 0],
  spine: 40,
  neck: -30,
  lArm: [-60, 0, 30],
  rArm: [-60, 0, -30],
  lElbow: -60,
  rElbow: -60,
  lLeg: -70,
  lKnee: 110,
  rLeg: [10, 0, 0],
  rKnee: 80,
});
export const JUMP_DOWN = P({
  ph: 0.9,
  spine: 10,
  lArm: [-40, 0, 50],
  rArm: [-40, 0, -50],
  lLeg: -40,
  rLeg: -20,
  lKnee: 60,
  rKnee: 60,
});
export const ROPE_BOUNCE = mod(RUN_A, { spine: -25, neck: 0, lArm: [20, 0, 50], rArm: [20, 0, -50], lLeg: 15, rLeg: -20 });
export const CORNER_SLUMP = P({
  ph: 0.7,
  spine: -15,
  neck: 30,
  lArm: [-10, 0, 80],
  rArm: [-10, 0, -80],
  lElbow: -10,
  rElbow: -10,
  lLeg: [-40, 0, 15],
  rLeg: [-40, 0, -15],
  lKnee: 60,
  rKnee: 60,
});
export const REF_KNEEL = P({
  ph: 0.3,
  pelvis: [70, 0, 0],
  spine: 0,
  neck: -40,
  lArm: [-60, 0, 20],
  rArm: [-170, 0, -15],
  lElbow: -30,
  rElbow: -10,
  lLeg: -70,
  lKnee: 140,
  rLeg: -70,
  rKnee: 140,
});
export const REF_SLAP = mod(REF_KNEEL, { rArm: [-90, 0, -10], rElbow: 0, spine: 10 });
export const REF_SIGNAL = P({
  spine: -5,
  rArm: [-170, 0, -10],
  rElbow: 0,
  lArm: [0, 0, 70],
  lElbow: 0,
  lLeg: [-3, 0, 4],
  rLeg: [-3, 0, -4],
});
export const REF_CHECK = mod(STANCE, { spine: 35, neck: 20, lArm: [-40, 0, 20], rArm: [-40, 0, -20], lElbow: -20, rElbow: -20 });
export const SWING_WIND = mod(STANCE, {
  spine: [-15, -40, 0],
  rArm: [-170, 0, -40],
  rElbow: -40,
  lArm: [-160, 0, 40],
  lElbow: -60,
});
export const SWING_HIT = mod(STANCE, {
  spine: [30, 25, 0],
  rArm: [-60, 0, 10],
  rElbow: -10,
  lArm: [-60, 0, -10],
  lElbow: -20,
});
export const CARRY = mod(STANCE, { rArm: [-60, 0, -20], rElbow: -60, lArm: [-60, 0, 20], lElbow: -60 });
export const THROW_WIND = mod(STANCE, { spine: -15, rArm: [-170, 0, -20], rElbow: -60, lArm: [-170, 0, 20], lElbow: -60 });
export const THROW_REL = mod(STANCE, { spine: 25, rArm: [-80, 0, -10], rElbow: -10, lArm: [-80, 0, 10], lElbow: -10 });

export type { PoseArr };
