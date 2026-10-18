import type { Key } from './pose';
import { mod } from './pose';
import * as K from './poses';

export type React = 'high' | 'gut' | 'down';

export interface StrikeDef {
  id: string;
  name: string;
  dur: number;
  keys: Key[];
  hitT: number;
  reach: number;
  arc: number; // min cos of angle to target
  dmg: number;
  react: React;
  knock?: number; // extra knockdown chance
  target: 'stand' | 'down';
  lunge?: number; // forward speed during windup
  carry?: number; // keep running speed (fraction)
  sound: 'hit' | 'crunch' | 'thud' | 'clang';
  endDown?: 'back' | 'front';
  airborne?: boolean;
  weapon?: boolean;
  over?: boolean; // can send people over the top rope
}

const S = (id: string, d: Omit<StrikeDef, 'id'>): StrikeDef => ({ id, ...d });

const JAB_HIT = mod(K.PUNCH_HIT, { rArm: [-85, 0, -10], spine: [10, 18, 0] });
const L_JAB = mod(K.STANCE, { spine: [10, -20, 0], lArm: [-88, 0, 8], lElbow: -5 });

export const STRIKES: Record<string, StrikeDef> = {
  jab: S('jab', {
    name: 'Jab',
    dur: 0.36,
    keys: [
      { t: 0, pose: K.STANCE },
      { t: 0.09, pose: mod(K.STANCE, { spine: [5, -10, 0] }) },
      { t: 0.16, pose: L_JAB },
      { t: 0.36, pose: K.STANCE },
    ],
    hitT: 0.16,
    reach: 1.05,
    arc: 0.55,
    dmg: 2.5,
    react: 'high',
    target: 'stand',
    lunge: 1.2,
    sound: 'hit',
  }),
  jab2: S('jab2', {
    name: 'Right Hand',
    dur: 0.4,
    keys: [
      { t: 0, pose: K.STANCE },
      { t: 0.1, pose: K.PUNCH_WIND },
      { t: 0.18, pose: JAB_HIT },
      { t: 0.4, pose: K.STANCE },
    ],
    hitT: 0.18,
    reach: 1.05,
    arc: 0.55,
    dmg: 3,
    react: 'high',
    target: 'stand',
    lunge: 1.2,
    sound: 'hit',
  }),
  punch: S('punch', {
    name: 'Haymaker',
    dur: 0.62,
    keys: [
      { t: 0, pose: K.STANCE },
      { t: 0.24, pose: K.PUNCH_WIND },
      { t: 0.33, pose: K.PUNCH_HIT },
      { t: 0.62, pose: K.STANCE },
    ],
    hitT: 0.33,
    reach: 1.15,
    arc: 0.5,
    dmg: 6,
    react: 'high',
    knock: 0.15,
    target: 'stand',
    lunge: 1.6,
    sound: 'crunch',
  }),
  forearm: S('forearm', {
    name: 'Forearm Smash',
    dur: 0.64,
    keys: [
      { t: 0, pose: K.STANCE },
      { t: 0.25, pose: K.FOREARM_WIND },
      { t: 0.35, pose: K.FOREARM_HIT },
      { t: 0.64, pose: K.STANCE },
    ],
    hitT: 0.35,
    reach: 1.15,
    arc: 0.5,
    dmg: 6,
    react: 'high',
    knock: 0.15,
    target: 'stand',
    lunge: 1.6,
    sound: 'crunch',
  }),
  kick: S('kick', {
    name: 'Big Boot',
    dur: 0.7,
    keys: [
      { t: 0, pose: K.STANCE },
      { t: 0.26, pose: K.KICK_WIND },
      { t: 0.36, pose: K.KICK_HIT },
      { t: 0.5, pose: K.KICK_HIT },
      { t: 0.7, pose: K.STANCE },
    ],
    hitT: 0.36,
    reach: 1.3,
    arc: 0.5,
    dmg: 6.5,
    react: 'gut',
    knock: 0.2,
    target: 'stand',
    lunge: 1.2,
    sound: 'crunch',
  }),
  stomp: S('stomp', {
    name: 'Stomp',
    dur: 0.55,
    keys: [
      { t: 0, pose: K.STAND },
      { t: 0.22, pose: K.STOMP_WIND },
      { t: 0.3, pose: K.STOMP_HIT },
      { t: 0.55, pose: K.STANCE },
    ],
    hitT: 0.3,
    reach: 1.2,
    arc: 0.3,
    dmg: 3.5,
    react: 'down',
    target: 'down',
    lunge: 0.6,
    sound: 'thud',
  }),
  clothesline: S('clothesline', {
    name: 'Clothesline',
    dur: 0.7,
    keys: [
      { t: 0, pose: K.CLOTHESLINE },
      { t: 0.25, pose: K.CLOTHESLINE },
      { t: 0.7, pose: K.STANCE },
    ],
    hitT: 0.12,
    reach: 1.35,
    arc: 0.35,
    dmg: 9,
    react: 'down',
    target: 'stand',
    carry: 0.8,
    sound: 'crunch',
    over: true,
  }),
  shoulder: S('shoulder', {
    name: 'Shoulder Block',
    dur: 0.7,
    keys: [
      { t: 0, pose: K.SHOULDER_BLOCK },
      { t: 0.25, pose: K.SHOULDER_BLOCK },
      { t: 0.7, pose: K.STANCE },
    ],
    hitT: 0.1,
    reach: 1.2,
    arc: 0.35,
    dmg: 8,
    react: 'down',
    target: 'stand',
    carry: 0.8,
    sound: 'thud',
    over: true,
  }),
  dropkick: S('dropkick', {
    name: 'Dropkick',
    dur: 1.0,
    keys: [
      { t: 0, pose: K.RUN_A },
      { t: 0.14, pose: K.DROPKICK_AIR },
      { t: 0.42, pose: K.DROPKICK_AIR },
      { t: 0.58, pose: K.DOWN_BACK },
      { t: 1.0, pose: K.DOWN_BACK },
    ],
    hitT: 0.24,
    reach: 1.5,
    arc: 0.35,
    dmg: 10,
    react: 'down',
    target: 'stand',
    carry: 0.9,
    sound: 'crunch',
    endDown: 'back',
    airborne: true,
    over: true,
  }),
  swing: S('swing', {
    name: 'Weapon Shot',
    dur: 0.75,
    keys: [
      { t: 0, pose: K.CARRY },
      { t: 0.3, pose: K.SWING_WIND },
      { t: 0.4, pose: K.SWING_HIT },
      { t: 0.75, pose: K.CARRY },
    ],
    hitT: 0.4,
    reach: 1.4,
    arc: 0.45,
    dmg: 12,
    react: 'high',
    knock: 0.5,
    target: 'stand',
    lunge: 1.0,
    sound: 'clang',
    weapon: true,
  }),
  swingdown: S('swingdown', {
    name: 'Weapon Shot',
    dur: 0.75,
    keys: [
      { t: 0, pose: K.CARRY },
      { t: 0.3, pose: K.SWING_WIND },
      { t: 0.4, pose: mod(K.SWING_HIT, { spine: 60, ph: 0.85 }) },
      { t: 0.75, pose: K.CARRY },
    ],
    hitT: 0.4,
    reach: 1.4,
    arc: 0.35,
    dmg: 9,
    react: 'down',
    target: 'down',
    lunge: 0.5,
    sound: 'clang',
    weapon: true,
  }),
};
