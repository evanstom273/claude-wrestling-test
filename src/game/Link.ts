import * as THREE from 'three';
import type { Wrestler } from './Wrestler';
import type { World } from './types';
import { type MoveDef, type Sample, newSample, sampleMove } from './moves';
import { PLAY_HALF, RING, chance, clamp, rand } from './constants';
import * as K from './poses';
import { audio } from './Audio';

export type LinkKind = 'hold' | 'move' | 'sub' | 'pin';

const S_A = newSample();
const S_V = newSample();
const tmp = new THREE.Vector3();

export class Link {
  t = 0;
  dead = false;
  def: MoveDef | null = null;
  anchor = new THREE.Vector3();
  anchorYaw = 0;
  atkOff = new THREE.Vector3();
  vicOff = new THREE.Vector3();
  behind = false;
  hitIdx = 0;
  finisher = false;
  escape = 0;
  tap = 0;
  count = 0;
  countT = 0;
  refReady = false;
  kickAt = 99;
  ropeBreakT = 0;
  constructor(
    public kind: LinkKind,
    public atk: Wrestler,
    public vic: Wrestler,
  ) {}

  /** Victim pressed a button. */
  mash(w: Wrestler, _W: World) {
    if (w !== this.vic) return;
    const hpF = w.hp / 100;
    if (this.kind === 'hold') this.escape += 0.16 + w.stats.tech * 0.008 + hpF * 0.06;
    else if (this.kind === 'pin') this.escape += (0.06 + 0.14 * hpF) * (recentFinisher(w, _W) ? 0.55 : 1);
    else if (this.kind === 'sub') this.escape += 0.04 + 0.06 * hpF;
  }
}

const finisherHits = new WeakMap<Wrestler, number>();
function recentFinisher(w: Wrestler, W: World) {
  const t = finisherHits.get(w);
  return t !== undefined && W.time - t < 8;
}

function attach(W: World, L: Link) {
  if (L.atk.link && L.atk.link !== L) removeLink(W, L.atk.link);
  if (L.vic.link && L.vic.link !== L) removeLink(W, L.vic.link);
  L.atk.link = L;
  L.atk.role = 'atk';
  L.vic.link = L;
  L.vic.role = 'vic';
  L.atk.strike = null;
  L.vic.strike = null;
  L.atk.setState(L.kind === 'hold' ? 'holding' : 'link');
  L.vic.setState(L.kind === 'hold' ? 'held' : 'link');
  L.vic.dropWeapon();
  W.links.push(L);
}

function removeLink(W: World, L: Link) {
  L.dead = true;
  const i = W.links.indexOf(L);
  if (i >= 0) W.links.splice(i, 1);
  if (L.atk.link === L) L.atk.link = null;
  if (L.vic.link === L) L.vic.link = null;
}

// ------------------------------------------------------------------ starting links
export function startHold(W: World, atk: Wrestler, vic: Wrestler, behind: boolean) {
  const L = new Link('hold', atk, vic);
  L.behind = behind;
  attach(W, L);
  atk.faceTowards(vic.pos.x, vic.pos.z);
  audio.thud();
  return L;
}

function headAngle(pose: Float32Array, ryRad: number) {
  // front-lying poses have the head toward local +Z, everything else toward local -Z
  return pose[0] > 0.7 ? ryRad : ryRad + Math.PI;
}

export function startMove(
  W: World,
  atk: Wrestler,
  vic: Wrestler,
  def: MoveDef,
  opts: { finisher?: boolean; faceVictim?: boolean; aroundVictim?: boolean } = {},
) {
  if (!def) return null;
  const L = new Link(def.submission ? 'move' : 'move', atk, vic);
  L.def = def;
  L.finisher = !!opts.finisher;
  const prevBehind = atk.link?.behind ?? false;
  L.behind = prevBehind;
  // anchor frame
  if (opts.aroundVictim) {
    sampleMove(def.vic, 0, S_V);
    const actualHead = vic.yaw + (vic.downFace === 'front' ? 0 : Math.PI);
    L.anchorYaw = actualHead - headAngle(S_V.pose, S_V.ry);
    tmp.set(S_V.p[0], 0, S_V.p[2]).applyAxisAngle(THREE.Object3D.DEFAULT_UP, L.anchorYaw);
    L.anchor.set(vic.pos.x - tmp.x, atk.groundY, vic.pos.z - tmp.z);
  } else {
    L.anchor.set(atk.pos.x, atk.groundY, atk.pos.z);
    L.anchorYaw = opts.faceVictim ? Math.atan2(vic.pos.x - atk.pos.x, vic.pos.z - atk.pos.z) : atk.yaw;
  }
  keepInBounds(L, atk.inRing);
  attach(W, L);
  // blend the start positions from where they actually are
  sampleMove(def.atk, 0, S_A);
  sampleMove(def.vic, 0, S_V);
  L.atkOff.copy(atk.pos).sub(world(L, S_A.p, tmp));
  L.vicOff.copy(vic.pos).sub(world(L, S_V.p, tmp));
  L.atkOff.y = L.vicOff.y = 0;
  atk.blend = vic.blend = 20;
  if (L.finisher) {
    atk.spirit = 0;
    W.banner(atk.profile.moves.finisherName, `${atk.name}'s finisher!`, 2.2);
    W.excite(1);
    audio.pop(1.4);
  }
  return L;
}

function keepInBounds(L: Link, inRing: boolean) {
  const def = L.def!;
  const pts: [number, number, number][] = [...def.atk, ...def.vic].map((k) => k.p ?? [0, 0, 0]);
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of pts) {
    world(L, p, tmp);
    minX = Math.min(minX, tmp.x);
    maxX = Math.max(maxX, tmp.x);
    minZ = Math.min(minZ, tmp.z);
    maxZ = Math.max(maxZ, tmp.z);
  }
  const lim = inRing ? PLAY_HALF + 0.2 : RING.floor;
  const fix = (mn: number, mx: number) => (mx > lim && mn < -lim ? -(mn + mx) / 2 : mx > lim ? lim - mx : mn < -lim ? -lim - mn : 0);
  L.anchor.x += fix(minX, maxX);
  L.anchor.z += fix(minZ, maxZ);
}

function world(L: Link, p: [number, number, number], out: THREE.Vector3) {
  out.set(p[0], 0, p[2]).applyAxisAngle(THREE.Object3D.DEFAULT_UP, L.anchorYaw);
  out.x += L.anchor.x;
  out.z += L.anchor.z;
  out.y = L.anchor.y + p[1];
  return out;
}

export function startPin(W: World, atk: Wrestler, vic: Wrestler) {
  const L = new Link('pin', atk, vic);
  if (vic.downFace === 'front') {
    vic.yaw += Math.PI;
    vic.downFace = 'back';
  }
  attach(W, L);
  const hpF = vic.hp / 100;
  const fin = recentFinisher(vic, W);
  let p = 0.3 + hpF * 1.3 + (vic.stats.tough - 1) * 0.6 - (fin ? 0.4 : 0);
  if (!vic.human) p += (W.difficulty - 0.5) * 0.2;
  p = clamp(p, 0.03, 0.99);
  L.kickAt = chance(p) ? (hpF > 0.55 ? rand(0.15, 1.7) : rand(1.5, 2.93)) : 99;
  W.say(`${atk.name} goes for the cover!`, atk.profile.colour);
  W.excite(0.4);
  return L;
}

// ------------------------------------------------------------------ breaking
export type BreakReason = 'interrupt' | 'release' | 'shove' | 'escape' | 'kickout' | 'ropebreak' | 'end';

export function breakLink(W: World, L: Link, reason: BreakReason) {
  if (L.dead) return;
  removeLink(W, L);
  const { atk, vic } = L;
  atk.normalise();
  vic.normalise();
  atk.link = null;
  vic.link = null;
  const away = tmp.set(vic.pos.x - atk.pos.x, 0, vic.pos.z - atk.pos.z).normalize();
  switch (reason) {
    case 'interrupt':
      if (L.kind === 'hold') vic.setState('idle');
      else if (L.kind === 'move') {
        vic.downFace = 'back';
        vic.setState('fall');
        vic.pos.y = vic.groundY;
      } else vic.setDown(vic.downFace, -0.3);
      break;
    case 'release':
      atk.setState('idle');
      vic.setState('idle');
      break;
    case 'shove':
      atk.setState('idle');
      vic.vel.copy(away).multiplyScalar(2.5);
      vic.hurtKind = 'high';
      vic.hurtDur = 0.4;
      vic.setState('hurt');
      break;
    case 'escape':
      atk.vel.copy(away).multiplyScalar(-2.8);
      atk.hurtKind = 'high';
      atk.hurtDur = 0.45;
      atk.setState('hurt');
      vic.setState('idle');
      break;
    case 'kickout':
      atk.endIn('sit');
      vic.setDown('back', -0.2);
      vic.target.set(K.KICKOUT);
      break;
    case 'ropebreak':
      if (L.kind === 'pin') atk.endIn('sit');
      else atk.setState('idle');
      vic.setDown(vic.downFace, -0.4);
      break;
    case 'end':
      atk.endIn(L.kind === 'pin' ? 'sit' : 'stand');
      vic.setDown(vic.downFace, 60);
      break;
  }
  for (const w of [atk, vic]) {
    if (w.state !== 'air') {
      w.pos.y = w.groundY;
      w.clampBounds();
    }
  }
}

// ------------------------------------------------------------------ per-frame
export function updateLinks(W: World, dt: number) {
  for (const L of [...W.links]) {
    if (L.dead) continue;
    L.t += dt;
    if (L.kind === 'hold') updHold(W, L, dt);
    else if (L.kind === 'move') updMove(W, L);
    else if (L.kind === 'sub') updSub(W, L, dt);
    else if (L.kind === 'pin') updPin(W, L, dt);
  }
}

function updHold(W: World, L: Link, dt: number) {
  const { atk, vic } = L;
  const dist = L.behind ? 0.5 : 0.7;
  const f = atk.facingVec(tmp);
  vic.pos.set(atk.pos.x + f.x * dist, atk.pos.y, atk.pos.z + f.z * dist);
  if (vic.inRing) {
    const cx = clamp(vic.pos.x, -PLAY_HALF, PLAY_HALF);
    const cz = clamp(vic.pos.z, -PLAY_HALF, PLAY_HALF);
    atk.pos.x += cx - vic.pos.x;
    atk.pos.z += cz - vic.pos.z;
    vic.pos.x = cx;
    vic.pos.z = cz;
  } else {
    vic.clampBounds();
    atk.pos.set(vic.pos.x - f.x * dist, atk.pos.y, vic.pos.z - f.z * dist);
    atk.clampBounds();
  }
  vic.yaw = L.behind ? atk.yaw : atk.yaw + Math.PI;
  const sway = Math.sin(L.t * 9) * 0.04;
  atk.target.set(L.behind ? K.HOLD_BEHIND : K.LOCKUP);
  vic.target.set(L.behind ? K.HELD_BEHIND : K.HELD);
  atk.target[1] += sway;
  vic.target[1] -= sway;
  // victim struggles
  if (!vic.human && !vic.ai?.passive) L.escape += dt * (0.2 + W.difficulty * 0.5 + vic.stats.tech * 0.03) * (0.5 + vic.hp / 100) * rand(0.5, 1.5);
  L.escape = Math.max(0, L.escape - dt * 0.15);
  if (L.escape >= 1) {
    const rev = chance(0.4 + (vic.stats.tech - atk.stats.tech) * 0.04);
    if (rev && !L.behind) {
      breakLink(W, L, 'release');
      W.say(`${vic.name} reverses the hold!`, vic.profile.colour);
      startHold(W, vic, atk, false);
    } else {
      breakLink(W, L, 'escape');
      W.say(`${vic.name} breaks free`, vic.profile.colour);
    }
    return;
  }
  // a human attacker who does nothing eventually lets go
  if (atk.human && L.t > 4) breakLink(W, L, 'shove');
}

function updMove(W: World, L: Link) {
  const { atk, vic } = L;
  const def = L.def!;
  const t = L.t;
  sampleMove(def.atk, t, S_A);
  sampleMove(def.vic, t, S_V);
  const k = Math.max(0, 1 - t / 0.22);
  setFromSample(L, atk, S_A, L.atkOff, k);
  setFromSample(L, vic, S_V, L.vicOff, k);
  // impacts
  while (L.hitIdx < def.hits.length && t >= def.hits[L.hitIdx].t) {
    const h = def.hits[L.hitIdx++];
    const mult = L.finisher ? 1.6 : 1;
    const dmg = vic.hurt(h.dmg * mult + (L.finisher ? 6 : 0), atk, W);
    if (L.finisher) finisherHits.set(vic, W.time);
    if (h.sound === 'slam') audio.slam();
    else if (h.sound === 'crunch') audio.crunch();
    else if (h.sound === 'thud') audio.thud();
    else audio.hit();
    W.shake((h.shake ?? 0.1) * (L.finisher ? 1.6 : 1));
    W.hitstop(L.finisher ? 0.16 : dmg > 10 ? 0.08 : 0.04);
    vic.rig.worldHead(tmp);
    W.sparks(tmp, L.finisher ? 18 : 8);
    W.excite(((def.excite ?? 0.6) * 0.5) * (L.finisher ? 2 : 1));
    if (L.hitIdx === 1) {
      if (!L.finisher) W.say(`${def.name.toUpperCase()}! ${atk.name} plants ${vic.name}`, atk.profile.colour);
      else W.say(`${atk.profile.moves.finisherName}!!! ${atk.name} hits the finisher!`, atk.profile.colour);
      if (dmg > 9) audio.pop(Math.min(1.5, dmg / 12));
      if (def.vicEnd === 'back' || def.vicEnd === 'front') W.arena.pushRope(vic.pos.x, vic.pos.z, 0.05);
    }
  }
  if (t >= def.dur) {
    if (def.submission) {
      L.kind = 'sub';
      L.t = 0;
      W.say(`${atk.name} locks in the ${def.name}!`, atk.profile.colour);
      W.excite(0.4);
      return;
    }
    if (def.id === 'pickup') {
      breakLink(W, L, 'release');
      startHold(W, atk, vic, false);
      return;
    }
    removeLink(W, L);
    const extra = def.hits.reduce((a, h) => a + h.dmg, 0) / 12 + (L.finisher ? 2 : 0);
    atk.endIn(def.atkEnd);
    if (def.atkEnd === 'back' || def.atkEnd === 'front') atk.downT = 0.35;
    vic.endIn(def.vicEnd, extra);
    for (const w of [atk, vic]) {
      w.pos.y = w.groundY;
      w.clampBounds();
    }
  }
}

function setFromSample(L: Link, w: Wrestler, s: Sample, off: THREE.Vector3, k: number) {
  world(L, s.p, w.pos);
  w.pos.x += off.x * k;
  w.pos.z += off.z * k;
  w.yaw = L.anchorYaw + s.ry;
  w.target.set(s.pose);
}

function nearRopes(w: Wrestler) {
  return w.inRing && (Math.abs(w.pos.x) > PLAY_HALF - 0.1 || Math.abs(w.pos.z) > PLAY_HALF - 0.1);
}

function updSub(W: World, L: Link, dt: number) {
  const { atk, vic } = L;
  const def = L.def!;
  sampleMove(def.atk, def.dur, S_A);
  sampleMove(def.vic, def.dur, S_V);
  setFromSample(L, atk, S_A, L.atkOff, 0);
  setFromSample(L, vic, S_V, L.vicOff, 0);
  const wob = Math.sin(L.t * 14) * 0.05;
  atk.target[3] += wob;
  vic.target[3] -= wob;
  const hpF = vic.hp / 100;
  vic.hp = Math.max(0, vic.hp - dt * 2.2 * atk.stats.power);
  vic.lastHurt = W.time;
  atk.spirit = Math.min(100, atk.spirit + dt * 3);
  L.tap += dt * (0.015 + (1 - hpF) * (1 - hpF) * 0.36) * (0.8 + atk.stats.tech * 0.04);
  if (!vic.human) L.escape += dt * (0.1 + 0.4 * hpF) * (0.7 + W.difficulty * 0.6) * rand(0.4, 1.6);
  L.escape = Math.max(0, L.escape - dt * 0.1);
  W.excite(dt * 0.15);
  if (nearRopes(vic) || nearRopes(atk)) {
    L.ropeBreakT += dt;
    if (L.ropeBreakT > 0.5) {
      W.banner('ROPE BREAK!', `${vic.name} reaches the ropes`, 1.5);
      W.arena.pushRope(vic.pos.x, vic.pos.z, 0.15, [0]);
      breakLink(W, L, 'ropebreak');
      return;
    }
  }
  if (L.escape >= 1) {
    W.say(`${vic.name} fights out of the ${def.name}!`, vic.profile.colour);
    W.excite(0.4);
    audio.pop(0.6);
    breakLink(W, L, 'ropebreak');
    return;
  }
  if (L.tap >= 1 && !W.over) {
    breakLink(W, L, 'end');
    W.win(atk, vic, 'submission');
  }
}

function updPin(W: World, L: Link, dt: number) {
  const { atk, vic } = L;
  // atk lies across victim's chest
  vic.target.set(K.PINNED);
  vic.pos.y = vic.groundY;
  const chest = tmp.set(0, 0, -0.32).applyAxisAngle(THREE.Object3D.DEFAULT_UP, vic.yaw).add(vic.pos);
  atk.yaw = vic.yaw + Math.PI / 2;
  const af = Math.sin(atk.yaw);
  const az = Math.cos(atk.yaw);
  atk.pos.set(chest.x - af * 0.42, vic.pos.y, chest.z - az * 0.42);
  atk.target.set(K.PIN_COVER);
  atk.blend = vic.blend = 16;
  if (!vic.human) {
    // AI kicks out at its chosen point in the count
    if (L.refReady && L.count + L.countT / 0.78 >= L.kickAt) L.escape = 1;
  } else {
    L.escape = Math.max(0, L.escape - dt * 0.25);
  }
  if (nearRopes(vic) && L.refReady) {
    W.banner('ROPE BREAK!', 'foot on the ropes', 1.4);
    breakLink(W, L, 'ropebreak');
    return;
  }
  if (L.escape >= 1) {
    W.banner('KICK OUT!', L.count >= 2 ? 'SO CLOSE!' : '', 1.2);
    W.say(`${vic.name} kicks out at ${L.count}!`, vic.profile.colour);
    W.excite(L.count >= 2 ? 1 : 0.4);
    audio.pop(L.count >= 2 ? 1.5 : 0.7);
    breakLink(W, L, 'kickout');
    return;
  }
  if (L.refReady) {
    L.countT += dt;
    if (L.countT >= 0.78) {
      L.countT = 0;
      L.count++;
      audio.slap();
      W.banner(String(L.count), '', 0.7);
      W.excite(0.25 * L.count);
      if (L.count >= 3 && !W.over) {
        breakLink(W, L, 'end');
        W.win(atk, vic, 'pinfall');
      }
    }
  } else if (L.t > 7) {
    // the referee never arrived
    breakLink(W, L, 'kickout');
  }
}
