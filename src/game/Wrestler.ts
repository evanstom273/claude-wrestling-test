import * as THREE from 'three';
import { Fighter } from './Fighter';
import { RING, PLAY_HALF, approachAngle, clamp, rand, chance, wrapAngle } from './constants';
import type { Wrestler as Profile } from './roster';
import type { Intent, ControlType } from './Input';
import type { World } from './types';
import { type StrikeDef, STRIKES } from './strikes';
import { sampleKeys, mod, type Key } from './pose';
import * as K from './poses';
import { MOVES } from './moves';
import { type Link, startHold, startMove, startPin, breakLink } from './Link';
import type { Weapon } from './Weapon';
import { audio } from './Audio';
import type { AI } from './AI';

export type St =
  | 'idle'
  | 'run'
  | 'strike'
  | 'hurt'
  | 'fall'
  | 'down'
  | 'getup'
  | 'holding'
  | 'held'
  | 'link'
  | 'whipped'
  | 'whip'
  | 'rope'
  | 'climb'
  | 'perch'
  | 'air'
  | 'taunt'
  | 'slump'
  | 'celebrate'
  | 'grabmiss'
  | 'throw'
  | 'pickup';

export type Level = 'stand' | 'down' | 'perch' | 'none';

const GETUP_BACK: Key[] = [
  { t: 0, pose: K.DOWN_BACK },
  { t: 0.3, pose: K.SIT },
  { t: 0.65, pose: K.KNEEL },
  { t: 1.0, pose: K.STANCE },
];
const GETUP_FRONT: Key[] = [
  { t: 0, pose: K.DOWN_FRONT },
  { t: 0.28, pose: K.PUSHUP },
  { t: 0.6, pose: K.KNEEL },
  { t: 0.95, pose: K.STANCE },
];
const WHIP_POSE = mod(K.STANCE, { rArm: [-80, 0, -10], rElbow: -5, spine: [10, 20, 0] });
const GRABMISS_POSE = mod(K.LOCKUP, { spine: 35, ph: 0.9 });

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

let nextId = 1;
const DAMAGE_SCALE = 0.55;

export class Wrestler extends Fighter {
  id = nextId++;
  hp = 100;
  spirit = 0;
  state: St = 'idle';
  st = 0;
  link: Link | null = null;
  role: 'atk' | 'vic' = 'atk';
  strike: StrikeDef | null = null;
  strikeHit = false;
  combo = 0;
  comboT = 0;
  hurtKind: 'high' | 'gut' = 'high';
  hurtDur = 0.4;
  downFace: 'back' | 'front' = 'back';
  downT = 0;
  whipDir = new THREE.Vector3();
  whipBounced = false;
  whipT = 0;
  whipper: Wrestler | null = null;
  perchPos = new THREE.Vector3();
  climbFrom = new THREE.Vector3();
  weapon: Weapon | null = null;
  lastHurt = -10;
  dive: { target: Wrestler | null; kind: 'cross' | 'splash' | 'elbow' | 'legdrop'; dmg: number } | null = null;
  bounceT = 0;
  ai: AI | null = null;
  eliminated = false;
  attackerOf: Wrestler | null = null; // who last hurt us, for AI grudges
  stats: { power: number; speed: number; tech: number; tough: number };
  walkSpeed: number;
  runSpeed: number;
  playerIndex = -1;
  lastGrabPress = -10;

  constructor(
    public profile: Profile,
    public ctl: ControlType,
  ) {
    super(profile.look);
    const s = profile.stats;
    this.stats = {
      power: 0.9 + s.power * 0.022,
      speed: s.speed,
      tech: s.technique,
      tough: 0.9 + s.toughness * 0.022,
    };
    this.walkSpeed = 1.9 + s.speed * 0.08;
    this.runSpeed = 4.3 + s.speed * 0.17;
  }

  get name() {
    return this.profile.name;
  }
  get human() {
    return this.ctl !== 'cpu';
  }
  get special() {
    return this.spirit >= 100;
  }

  setState(s: St) {
    this.state = s;
    this.st = 0;
    this.blend = 14;
  }

  /** How this wrestler can currently be targeted. */
  level(): Level {
    switch (this.state) {
      case 'idle':
      case 'run':
      case 'hurt':
      case 'taunt':
      case 'holding':
      case 'held':
      case 'whipped':
      case 'whip':
      case 'slump':
      case 'celebrate':
      case 'grabmiss':
      case 'throw':
        return 'stand';
      case 'strike':
        return this.strike?.airborne ? 'none' : 'stand';
      case 'getup':
        return this.st > 0.55 ? 'stand' : 'down';
      case 'down':
        return 'down';
      case 'fall':
        return this.st > 0.3 ? 'down' : 'none';
      case 'perch':
      case 'climb':
        return 'perch';
      case 'link':
        if (!this.link) return 'none';
        if (this.link.kind === 'pin' || this.link.kind === 'sub') return this.role === 'atk' ? 'stand' : 'down';
        if (this.link.kind === 'move') return this.role === 'atk' ? 'stand' : 'none';
        return 'stand';
      default:
        return 'none';
    }
  }

  hurt(amount: number, from: Wrestler | null, W: World) {
    const dmg = (DAMAGE_SCALE * amount * (from ? from.stats.power : 1)) / this.stats.tough;
    this.hp = Math.max(0, this.hp - dmg);
    this.lastHurt = W.time;
    this.spirit = Math.max(0, this.spirit - dmg * 0.5);
    if (from) {
      from.spirit = Math.min(100, from.spirit + dmg * 1.5);
      this.attackerOf = from;
      if (from.spirit >= 100 && from.spirit - dmg * 1.5 < 100 && !W.over) {
        W.say(`${from.name} has the momentum! SPECIAL ready`, from.profile.colour);
      }
    }
    return dmg;
  }

  dropWeapon(throwVel?: THREE.Vector3) {
    if (!this.weapon) return;
    this.weapon.drop(throwVel);
    this.weapon = null;
  }

  // ------------------------------------------------------------------ main update
  update(dt: number, it: Intent, W: World) {
    this.st += dt;
    this.comboT -= dt;
    if (W.time - this.lastHurt > 4 && this.state !== 'link' && this.state !== 'down') {
      this.hp = Math.min(100, this.hp + dt * 0.3);
    }
    switch (this.state) {
      case 'idle':
        this.updIdle(dt, it, W);
        break;
      case 'run':
        this.updRun(dt, it, W);
        break;
      case 'strike':
        this.updStrike(dt, W);
        break;
      case 'hurt':
        this.target.set(this.hurtKind === 'gut' ? K.HURT_GUT : K.HURT_HIGH);
        this.slide(dt);
        if (this.st > this.hurtDur) this.setState('idle');
        break;
      case 'fall':
        this.target.set(this.st < 0.16 ? (this.downFace === 'back' ? K.FALLING_BACK : K.FALLING_FRONT) : this.downFace === 'back' ? K.DOWN_BACK : K.DOWN_FRONT);
        this.blend = 16;
        this.slide(dt);
        if (this.st > 0.42) {
          audio.thud();
          this.setDown(this.downFace, 0);
        }
        break;
      case 'down':
        this.updDown(dt, it);
        break;
      case 'getup':
        sampleKeys(this.downFace === 'back' ? GETUP_BACK : GETUP_FRONT, this.st, this.target);
        this.blend = 18;
        if (this.st > 1.0) this.setState('idle');
        break;
      case 'holding':
      case 'held':
      case 'link':
        this.updLinked(it, W);
        break;
      case 'whipped':
        this.updWhipped(dt, W);
        break;
      case 'whip':
        this.target.set(WHIP_POSE);
        if (this.st > 0.4) this.setState('idle');
        break;
      case 'rope':
        if (this.updateRope(dt)) this.setState('idle');
        break;
      case 'climb': {
        const u = Math.min(1, this.st / 0.75);
        this.pos.lerpVectors(this.climbFrom, this.perchPos, u);
        this.pos.y = this.climbFrom.y + (this.perchPos.y - this.climbFrom.y) * Math.min(1, u * 1.3);
        this.target.set(K.CLIMB);
        this.yaw = Math.atan2(-this.perchPos.x, -this.perchPos.z) + Math.PI;
        if (u >= 1) {
          this.setState('perch');
          this.faceTowards(0, 0);
        }
        break;
      }
      case 'perch':
        this.updPerch(it, W);
        break;
      case 'air':
        if (this.updateAir(dt)) this.landAir(W);
        break;
      case 'taunt':
        this.updTaunt(dt, W);
        break;
      case 'slump':
        this.target.set(K.CORNER_SLUMP);
        if (this.st > 1.8) this.setState('idle');
        break;
      case 'celebrate': {
        const b = Math.sin(this.st * 5);
        this.target.set(b > 0 ? K.VICTORY : K.TAUNT_CROWD);
        this.blend = 6;
        break;
      }
      case 'grabmiss':
        this.target.set(GRABMISS_POSE);
        if (this.st > 0.4) this.setState('idle');
        break;
      case 'throw':
        this.target.set(this.st < 0.22 ? K.THROW_WIND : K.THROW_REL);
        if (this.st > 0.22 && this.weapon) {
          const f = this.facingVec(tmpV).multiplyScalar(9);
          f.y = 3.5;
          this.dropWeapon(f);
          audio.whoosh();
        }
        if (this.st > 0.5) this.setState('idle');
        break;
      case 'pickup':
        this.target.set(this.st < 0.25 ? mod(K.SQUAT_LIFT, { ph: 0.7 }) : K.CARRY);
        if (this.st > 0.45) this.setState('idle');
        break;
    }
    if (this.state !== 'link' && this.state !== 'holding' && this.state !== 'held' && this.state !== 'air' && this.state !== 'rope' && this.state !== 'climb' && this.state !== 'perch') {
      this.clampBounds();
      this.pos.y = this.groundY;
    }
  }

  private slide(dt: number) {
    this.pos.addScaledVector(this.vel, dt);
    this.vel.multiplyScalar(Math.exp(-5 * dt));
  }

  // ------------------------------------------------------------------ idle / movement
  private updIdle(dt: number, it: Intent, W: World) {
    const mag = Math.hypot(it.mx, it.my);
    let speed = 0;
    if (mag > 0.2) {
      const ty = Math.atan2(it.mx, it.my);
      this.yaw = approachAngle(this.yaw, ty, 12 * dt);
      speed = this.walkSpeed * Math.min(1, mag) * (this.weapon ? 0.85 : 1);
      this.pos.x += Math.sin(ty) * speed * dt;
      this.pos.z += Math.cos(ty) * speed * dt;
      if (it.run && mag > 0.4) {
        this.setState('run');
        return;
      }
      const nOut = this.ropeExitNormal(it.mx, it.my);
      const nIn = nOut ? null : this.ropeEnterNormal(it.mx, it.my);
      if (nOut || nIn) {
        this.ropePush += dt;
        if (this.ropePush > (this.human ? 0.28 : 0.15)) {
          if (nOut) this.startRopeExit(nOut);
          else this.startRopeEnter(nIn!);
          this.setState('rope');
          return;
        }
      } else this.ropePush = 0;
    } else this.ropePush = 0;
    this.locoPose(dt, speed, false, this.weapon ? K.CARRY : K.STANCE);
    this.slide(dt);

    if (it.attack) this.doAttack(it, W);
    else if (it.grab) this.doGrab(it, W);
    else if (it.pick) this.doPick(W);
    else if (it.taunt) this.doTaunt(W);
  }

  private updRun(dt: number, it: Intent, W: World) {
    const mag = Math.hypot(it.mx, it.my);
    if (mag > 0.3) this.yaw = approachAngle(this.yaw, Math.atan2(it.mx, it.my), 4.5 * dt);
    const f = this.facingVec(tmpV);
    const sp = this.runSpeed * (this.weapon ? 0.85 : 1);
    this.pos.addScaledVector(f, sp * dt);
    this.bounceT -= dt;
    if (this.bounceT > 0) this.target.set(K.ROPE_BOUNCE);
    else this.locoPose(dt, sp, true);
    if (!it.run) {
      this.vel.copy(f).multiplyScalar(sp * 0.4);
      this.setState('idle');
      return;
    }
    if (this.inRing) {
      this.ropeBounceCheck(W, f);
    } else {
      const F = RING.floor;
      const m = RING.apron + 0.3;
      if (Math.abs(this.pos.x) > F || Math.abs(this.pos.z) > F || (Math.abs(this.pos.x) < m && Math.abs(this.pos.z) < m)) {
        this.setState('idle');
        return;
      }
    }
    if (it.attack) {
      const d = this.findTarget(W, 2.4, 0.6, 'down');
      if (d) this.startDive(W, d, false);
      else this.startStrike(STRIKES[this.weapon ? 'swing' : this.profile.moves.running], W);
    } else if (it.grab && !this.weapon) {
      const t = this.findTarget(W, 1.35, 0.5, 'stand');
      if (t && !t.link) {
        if (t.state === 'whipped' || (t.state === 'run' && t.facingDot(this) > 0.4)) startMove(W, this, t, MOVES[this.profile.moves.counterWhip]);
        else startMove(W, this, t, MOVES[this.profile.moves.runningGrab], { faceVictim: true });
      }
    } else if (it.pick) this.doPick(W);
  }

  /** Bounce off the ropes if we've reached them while running; returns true on bounce. */
  ropeBounceCheck(W: World, f: THREE.Vector3) {
    let bounced = false;
    if (Math.abs(this.pos.x) > PLAY_HALF && Math.sign(f.x) === Math.sign(this.pos.x) && Math.abs(f.x) > 0.3) {
      this.yaw = Math.atan2(-f.x, f.z);
      bounced = true;
    } else if (Math.abs(this.pos.z) > PLAY_HALF && Math.sign(f.z) === Math.sign(this.pos.z) && Math.abs(f.z) > 0.3) {
      this.yaw = Math.atan2(f.x, -f.z);
      bounced = true;
    }
    if (bounced) {
      W.arena.pushRope(this.pos.x, this.pos.z, 0.35);
      audio.rope();
      this.bounceT = 0.22;
      this.clampBounds();
    }
    return bounced;
  }

  // ------------------------------------------------------------------ actions
  findTarget(W: World, range: number, minDot: number, kind: 'stand' | 'down'): Wrestler | null {
    let best: Wrestler | null = null;
    let bd = range;
    for (const o of W.wrestlers) {
      if (o === this || o.eliminated) continue;
      if (o.inRing !== this.inRing) continue;
      if (Math.abs(o.pos.y - this.pos.y) > 0.6) continue;
      if (o.level() !== kind) continue;
      const d = this.distTo(o);
      if (d > bd) continue;
      if (d > 0.35 && this.facingDot(o) < minDot) continue;
      bd = d;
      best = o;
    }
    return best;
  }

  private doAttack(it: Intent, W: World) {
    if (this.weapon) {
      const d = this.findTarget(W, 1.5, 0.3, 'down');
      this.startStrike(STRIKES[d ? 'swingdown' : 'swing'], W);
      return;
    }
    const down = this.findTarget(W, 1.4, 0.2, 'down');
    const stand = this.findTarget(W, 1.4, 0.3, 'stand');
    if (down && !stand) {
      this.startStrike(STRIKES.stomp, W);
      return;
    }
    const moving = Math.hypot(it.mx, it.my) > 0.3;
    if (this.comboT <= 0) this.combo = 0;
    let s: StrikeDef;
    if (moving || this.combo >= 2) {
      s = STRIKES[this.profile.moves.strike];
      this.combo = 0;
    } else {
      s = this.combo === 0 ? STRIKES.jab : STRIKES.jab2;
      this.combo++;
    }
    this.comboT = 0.9;
    this.startStrike(s, W);
  }

  startStrike(s: StrikeDef, _W: World) {
    this.strike = s;
    this.strikeHit = false;
    this.setState('strike');
    this.blend = 22;
    audio.whoosh();
  }

  private updStrike(dt: number, W: World) {
    const s = this.strike!;
    sampleKeys(s.keys, this.st, this.target);
    const f = this.facingVec(tmpV);
    if (s.lunge && this.st < s.hitT) this.pos.addScaledVector(f, s.lunge * dt);
    if (s.carry) this.pos.addScaledVector(f, this.runSpeed * s.carry * Math.max(0, 1 - this.st / (s.dur * 0.7)) * dt);
    if (s.carry && this.inRing && this.ropeBounceCheck(W, f)) {
      // stop at the ropes instead of bouncing mid-attack
      this.yaw = wrapAngle(this.yaw + Math.PI);
      this.bounceT = 0;
    }
    if (this.weapon && this.strike) {
      // nothing extra, weapon is in hand
    }
    if (!this.strikeHit && this.st >= s.hitT) {
      this.strikeHit = true;
      this.resolveStrike(s, W);
    }
    if (this.st >= s.dur) {
      if (s.endDown) {
        this.downFace = s.endDown;
        this.setDown(s.endDown, -10);
        this.downT = 0.25;
      } else this.setState('idle');
    }
  }

  private resolveStrike(s: StrikeDef, W: World) {
    let any = false;
    for (const o of W.wrestlers) {
      if (o === this || o.eliminated) continue;
      if (o.inRing !== this.inRing && o.state !== 'perch' && o.state !== 'climb') continue;
      const lv = o.level();
      if (s.target === 'stand' && lv !== 'stand' && lv !== 'perch') continue;
      if (s.target === 'down' && lv !== 'down') continue;
      if (lv !== 'perch' && Math.abs(o.pos.y - this.pos.y) > 0.6) continue;
      const d = this.distTo(o);
      const reach = s.reach + (lv === 'perch' ? 0.35 : 0);
      if (d > reach) continue;
      if (d > 0.3 && this.facingDot(o) < s.arc) continue;
      o.takeStrike(this, s, W);
      any = true;
    }
    if (!any) {
      if (s.weapon && this.weapon) audio.whoosh();
    }
  }

  takeStrike(from: Wrestler, s: StrikeDef, W: World) {
    if (this.state === 'perch' || this.state === 'climb') {
      this.hurt(s.dmg * 0.6, from, W);
      audio.hit();
      W.say(`${from.name} knocks ${this.name} off the top!`, from.profile.colour);
      W.excite(0.6);
      const inward = tmpV.set(-Math.sign(this.perchPos.x), 0, -Math.sign(this.perchPos.z)).normalize();
      const to = tmpV2.copy(this.pos).addScaledVector(inward, 1.1);
      to.y = RING.H;
      this.launch(to, 0.55, 0.3, K.FALLING_BACK, 'back', true);
      this.setState('air');
      return;
    }
    if (this.link && (this.role === 'atk' || this.link.kind === 'hold')) breakLink(W, this.link, 'interrupt');
    const slumped = this.state === 'slump';
    let dmg = s.dmg * (slumped ? 1.5 : 1);
    if (s.weapon && from.weapon) dmg = s.target === 'down' ? from.weapon.dmg * 0.75 : from.weapon.dmg;
    const real = this.hurt(dmg, from, W);
    this.dropWeapon();
    this.rig.worldHead(tmpV);
    W.sparks(tmpV, s.weapon ? 10 : 5, s.weapon ? '#fff2a8' : '#ffffff');
    if (s.sound === 'clang') audio.clang();
    else if (s.sound === 'crunch') audio.crunch();
    else if (s.sound === 'thud') audio.thud();
    else audio.hit();
    W.shake(real > 7 ? 0.18 : 0.06);
    if (real > 7) W.hitstop(0.07);
    if (s.weapon) {
      W.say(`${from.name} cracks ${this.name} with a ${from.weapon?.name ?? 'weapon'}!`, from.profile.colour);
      W.excite(0.6);
    } else if (s.id !== 'jab' && s.id !== 'jab2' && s.id !== 'stomp' && chance(0.6)) {
      W.say(`${s.name} from ${from.name}!`, from.profile.colour);
    }
    if (s.target === 'down') {
      if (this.state === 'down') this.downT += 0.35;
      this.target[3] += 0.3; // a little jolt
      W.excite(0.05);
      return;
    }
    const hpLoss = (100 - this.hp) / 100;
    const knockChance = (s.knock ?? 0) + 0.02 + hpLoss * hpLoss * 0.4 + (slumped ? 0.3 : 0);
    if (s.react === 'down' || chance(knockChance)) {
      this.knockDown(from, W, !!s.over, s.react === 'down' ? 4 : 2.5);
      W.excite(0.25);
    } else {
      this.faceTowards(from.pos.x, from.pos.z);
      this.hurtKind = s.react === 'gut' ? 'gut' : 'high';
      this.hurtDur = s.react === 'gut' ? 0.85 : 0.42 + (s.dmg > 4 ? 0.15 : 0);
      this.vel.set(this.pos.x - from.pos.x, 0, this.pos.z - from.pos.z).normalize().multiplyScalar(s.dmg > 4 ? 2.4 : 1.6);
      this.setState('hurt');
      this.blend = 25;
    }
  }

  knockDown(from: Wrestler | null, W: World, allowOver: boolean, push = 3.5) {
    if (this.link) breakLink(W, this.link, 'interrupt');
    this.dropWeapon();
    const dir = tmpV.set(0, 0, 1);
    if (from) {
      dir.set(this.pos.x - from.pos.x, 0, this.pos.z - from.pos.z);
      if (dir.lengthSq() < 1e-4) from.facingVec(dir);
      dir.normalize();
      this.yaw = Math.atan2(-dir.x, -dir.z);
    }
    if (allowOver && this.inRing && this.tryOverTheTop(dir, W)) return;
    this.downFace = 'back';
    this.vel.copy(dir).multiplyScalar(push);
    this.setState('fall');
    this.blend = 18;
  }

  /** Send this wrestler tumbling over the top rope to the floor if they're near the ropes. */
  tryOverTheTop(dir: THREE.Vector3, W: World) {
    const px = this.pos.x + dir.x * 0.9;
    const pz = this.pos.z + dir.z * 0.9;
    const corner = PLAY_HALF - 0.5;
    let to: THREE.Vector3 | null = null;
    if (Math.abs(px) > PLAY_HALF + 0.15 && Math.abs(this.pos.z) < corner && Math.abs(dir.x) > 0.5) {
      to = new THREE.Vector3(Math.sign(px) * (RING.apron + 1.0), 0, clamp(this.pos.z + dir.z * 0.8, -RING.floor, RING.floor));
    } else if (Math.abs(pz) > PLAY_HALF + 0.15 && Math.abs(this.pos.x) < corner && Math.abs(dir.z) > 0.5) {
      to = new THREE.Vector3(clamp(this.pos.x + dir.x * 0.8, -RING.floor, RING.floor), 0, Math.sign(pz) * (RING.apron + 1.0));
    }
    if (!to) return false;
    W.arena.pushRope(this.pos.x, this.pos.z, 0.5, [1, 2]);
    audio.rope();
    this.downFace = 'back';
    this.launch(to, 0.8, 0.9, K.FALLING_BACK, 'back', false, -2.2);
    this.setState('air');
    W.say(`${this.name} goes OVER THE TOP ROPE!`);
    W.excite(0.9);
    audio.pop(1.2);
    this.lastHurt = W.time;
    this.hp = Math.max(0, this.hp - 4);
    return true;
  }

  private doGrab(it: Intent, W: World) {
    this.lastGrabPress = W.time;
    if (this.weapon) {
      this.dropWeapon();
      return;
    }
    const t = this.findTarget(W, 1.2, 0.3, 'stand');
    if (t && !t.link && t.state !== 'perch') {
      if (t.state === 'whipped' || (t.state === 'run' && t.facingDot(this) > 0.4)) {
        startMove(W, this, t, MOVES[this.profile.moves.counterWhip], { faceVictim: true });
        return;
      }
      const behind = t.facingDot(this) < -0.35 && t.state !== 'slump';
      // a ready opponent facing us can win the lock-up and turn it around
      if (!behind && (t.state === 'idle' || t.state === 'grabmiss') && t.facingDot(this) > 0.3) {
        const edge = (t.stats.tech - this.stats.tech) * 0.025 + (t.hp - this.hp) * 0.002;
        const counter = t.human ? W.time - t.lastGrabPress < 0.35 : !t.ai?.passive && chance(0.08 + W.difficulty * 0.14 + edge);
        if (counter) {
          W.say(`${t.name} wins the lock-up!`, t.profile.colour);
          startHold(W, t, this, false);
          return;
        }
      }
      startHold(W, this, t, behind);
      return;
    }
    const d = this.findTarget(W, 1.6, -0.2, 'down');
    if (d && !d.link && d.state === 'down') {
      if (Math.hypot(it.mx, it.my) > 0.3) startMove(W, this, d, MOVES[this.profile.moves.submission], { aroundVictim: true });
      else startMove(W, this, d, MOVES.pickup, { aroundVictim: true });
      return;
    }
    this.setState('grabmiss');
  }

  private doPick(W: World) {
    const d = this.findTarget(W, 1.6, -1, 'down');
    if (d && !d.link && d.state === 'down') {
      if (this.weapon) this.dropWeapon();
      startPin(W, this, d);
      return;
    }
    if (!this.weapon) {
      for (const wpn of W.weapons) {
        if (wpn.holder || wpn.flying) continue;
        if (Math.hypot(wpn.pos.x - this.pos.x, wpn.pos.z - this.pos.z) < 1.0 && Math.abs(wpn.pos.y - this.pos.y) < 0.5) {
          wpn.attach(this);
          this.weapon = wpn;
          this.setState('pickup');
          W.say(`${this.name} grabs a ${wpn.name}!`, this.profile.colour);
          W.excite(0.3);
          return;
        }
      }
    } else {
      this.setState('throw');
      return;
    }
    // climb the nearest turnbuckle
    if (this.inRing && Math.abs(this.pos.x) > PLAY_HALF - 0.75 && Math.abs(this.pos.z) > PLAY_HALF - 0.75) {
      this.climbFrom.copy(this.pos);
      this.perchPos.set(Math.sign(this.pos.x) * (PLAY_HALF + 0.2), RING.H + 0.82, Math.sign(this.pos.z) * (PLAY_HALF + 0.2));
      this.setState('climb');
    }
  }

  private doTaunt(W: World) {
    if (this.weapon) return;
    this.setState('taunt');
    this.blend = 8;
    if (chance(0.5)) W.say(`${this.name} plays to the crowd`, this.profile.colour);
  }

  private updTaunt(dt: number, W: World) {
    const style = this.profile.style;
    const ph = Math.floor(this.st * 2.5) % 2;
    if (style === 'showman' || style === 'highflyer') this.target.set(ph ? K.TAUNT_CROWD : K.TAUNT_POINT);
    else if (style === 'powerhouse' || style === 'hardcore') this.target.set(ph ? K.TAUNT_FLEX : K.TAUNT_FLEX2);
    else this.target.set(ph ? K.TAUNT_POINT : K.TAUNT_FLEX);
    this.spirit = Math.min(100, this.spirit + dt * 15);
    W.excite(dt * 0.2);
    if (this.st > 1.6) this.setState('idle');
  }

  // ------------------------------------------------------------------ down / getup
  setDown(face: 'back' | 'front', extra: number) {
    this.downFace = face;
    this.setState('down');
    const hurtness = 1 - this.hp / 100;
    this.downT = Math.max(0.3, 0.9 + hurtness * 3.0 + rand(0, 0.6) + extra);
    this.vel.multiplyScalar(0.3);
  }

  private updDown(dt: number, it: Intent) {
    const writhe = this.downFace === 'back' && Math.sin(this.st * 2.2) > 0.6 && this.hp < 70;
    this.target.set(this.downFace === 'back' ? (writhe ? K.DOWN_BACK_WRITHE : K.DOWN_BACK) : K.DOWN_FRONT);
    this.blend = 8;
    this.slide(dt);
    this.downT -= dt;
    if (it.mash) this.downT -= 0.12;
    if (this.downT <= 0) this.setState('getup');
  }

  // ------------------------------------------------------------------ linked states
  private updLinked(it: Intent, W: World) {
    const L = this.link;
    if (!L) {
      this.setState('idle');
      return;
    }
    if (this.role === 'vic') {
      if (it.mash) L.mash(this, W);
      return;
    }
    if (L.kind !== 'hold' || L.t < 0.18) return;
    const mv = this.profile.moves;
    const dir = Math.hypot(it.mx, it.my) > 0.3;
    let id: string | null = null;
    let fin = false;
    if (it.taunt && this.special) {
      id = mv.finisher;
      fin = true;
    } else if (it.run) {
      // irish whip
      const v = L.vic;
      breakLink(W, L, 'release');
      const d = dir ? tmpV.set(it.mx, 0, it.my).normalize() : this.facingVec(tmpV);
      v.startWhipped(d, this, W);
      this.setState('whip');
      this.faceTowards(this.pos.x + d.x, this.pos.z + d.z);
      return;
    } else if (it.attack) id = L.behind ? mv.behindA : dir ? mv.grappleADir : mv.grappleA;
    else if (it.grab) id = L.behind ? mv.behindG : dir ? mv.grappleGDir : mv.grappleG;
    else if (it.pick) {
      breakLink(W, L, 'shove');
      return;
    }
    if (id) startMove(W, this, L.vic, MOVES[id], { finisher: fin });
  }

  startWhipped(dir: THREE.Vector3, by: Wrestler, W: World) {
    this.whipDir.copy(dir).setY(0).normalize();
    // aim for the corner if roughly diagonal
    if (this.inRing && Math.abs(Math.abs(this.whipDir.x) - Math.abs(this.whipDir.z)) < 0.35) {
      const cx = Math.sign(this.whipDir.x) * PLAY_HALF;
      const cz = Math.sign(this.whipDir.z) * PLAY_HALF;
      this.whipDir.set(cx - this.pos.x, 0, cz - this.pos.z).normalize();
    }
    this.whipBounced = false;
    this.whipT = 0;
    this.whipper = by;
    this.yaw = Math.atan2(this.whipDir.x, this.whipDir.z);
    this.setState('whipped');
    audio.whoosh();
    if (chance(0.4)) W.say(`${by.name} whips ${this.name} into the ${this.inRing ? 'ropes' : 'barricade'}`, by.profile.colour);
  }

  private updWhipped(dt: number, W: World) {
    const sp = 4.3 + this.stats.speed * 0.08;
    this.pos.addScaledVector(this.whipDir, sp * dt);
    this.whipT += dt;
    this.locoPose(dt, sp, true);
    if (this.inRing) {
      const nearX = Math.abs(this.pos.x) > PLAY_HALF - 0.05;
      const nearZ = Math.abs(this.pos.z) > PLAY_HALF - 0.05;
      if (nearX && nearZ || (Math.abs(this.pos.x) > PLAY_HALF - 0.25 && Math.abs(this.pos.z) > PLAY_HALF - 0.25 && (nearX || nearZ))) {
        // into the turnbuckle
        this.pos.set(Math.sign(this.pos.x) * (PLAY_HALF - 0.05), this.pos.y, Math.sign(this.pos.z) * (PLAY_HALF - 0.05));
        this.faceTowards(0, 0);
        this.hurt(4, this.whipper, W);
        audio.thud();
        W.shake(0.12);
        this.setState('slump');
        return;
      }
      if (!this.whipBounced) {
        const f = this.facingVec(tmpV);
        if (this.ropeBounceCheck(W, f)) {
          this.whipBounced = true;
          this.whipT = 0;
          this.whipDir.copy(this.facingVec(tmpV));
          // come back towards whoever sent us
          const w = this.whipper;
          if (w && w.inRing) {
            tmpV2.set(w.pos.x - this.pos.x, 0, w.pos.z - this.pos.z).normalize();
            if (tmpV2.dot(this.whipDir) > 0.4) {
              this.whipDir.copy(tmpV2);
              this.yaw = Math.atan2(tmpV2.x, tmpV2.z);
            }
          }
        }
      } else if (this.whipT > 1.3 || (this.whipT > 0.3 && (Math.abs(this.pos.x) >= PLAY_HALF || Math.abs(this.pos.z) >= PLAY_HALF))) {
        this.vel.copy(this.whipDir).multiplyScalar(2);
        this.setState('idle');
      }
    } else {
      const F = RING.floor - 0.05;
      const m = RING.apron + 0.35;
      const hitBarricade = Math.abs(this.pos.x) > F || Math.abs(this.pos.z) > F;
      const hitApron = Math.abs(this.pos.x) < m && Math.abs(this.pos.z) < m;
      if (hitBarricade || hitApron) {
        this.clampBounds();
        this.hurt(7, this.whipper, W);
        audio.slam();
        W.shake(0.25);
        W.say(`${this.name} crashes into the ${hitBarricade ? 'barricade' : 'ring apron'}!`);
        W.excite(0.5);
        this.yaw = Math.atan2(-this.whipDir.x, -this.whipDir.z);
        this.downFace = 'back';
        this.setState('fall');
        return;
      }
      if (this.whipT > 2.2) this.setState('idle');
    }
  }

  // ------------------------------------------------------------------ high risk
  private updPerch(it: Intent, W: World) {
    this.target.set(it.taunt || this.st % 3 > 2.4 ? K.PERCHED_TAUNT : K.PERCHED);
    this.blend = 8;
    this.pos.copy(this.perchPos);
    if (it.taunt) this.spirit = Math.min(100, this.spirit + 4);
    if (it.attack) {
      // find a target in the ring
      let best: Wrestler | null = null;
      let bd = 5.2;
      for (const o of W.wrestlers) {
        if (o === this || !o.inRing || o.eliminated) continue;
        const lv = o.level();
        if (lv !== 'stand' && lv !== 'down') continue;
        const d = this.distTo(o);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      this.startDive(W, best, true);
      return;
    }
    if (it.pick || it.grab) {
      this.pos.copy(this.climbFrom);
      this.setState('idle');
    }
  }

  startDive(W: World, t: Wrestler | null, fromTop: boolean) {
    const to = new THREE.Vector3();
    let kind: 'cross' | 'splash' | 'elbow' | 'legdrop';
    if (t) {
      to.copy(t.pos);
      kind = t.level() === 'down' ? this.profile.moves.dive : 'cross';
      // stop a little short for a crossbody so we collide
      if (kind === 'cross') {
        const d = tmpV.subVectors(t.pos, this.pos).setY(0);
        to.addScaledVector(d.normalize(), -0.3);
      }
    } else {
      const f = this.facingVec(tmpV);
      to.copy(this.pos).addScaledVector(f, 2.4);
      kind = this.profile.moves.dive;
    }
    to.y = RING.H;
    if (!fromTop) to.y = this.groundY;
    this.faceTowards(to.x, to.z);
    const pose = kind === 'cross' || kind === 'splash' ? K.DIVE_SPREAD : kind === 'elbow' ? K.ELBOW_DROP : K.LEG_DROP;
    const toRing = fromTop ? true : this.inRing;
    if (toRing) {
      to.x = clamp(to.x, -PLAY_HALF, PLAY_HALF);
      to.z = clamp(to.z, -PLAY_HALF, PLAY_HALF);
    }
    this.launch(to, fromTop ? 0.75 : 0.5, fromTop ? 1.0 : 0.55, pose, 'dive', toRing);
    this.dive = { target: t, kind, dmg: fromTop ? (kind === 'cross' ? 11 : 15) : 8 };
    this.setState('air');
    this.blend = 10;
    audio.whoosh();
    if (fromTop) {
      W.excite(0.6);
      W.say(`${this.name} comes off the top rope!`, this.profile.colour);
    }
  }

  private landAir(W: World) {
    const air = this.dive;
    if (!air) {
      // generic landing (knocked over the ropes / off the top)
      audio.slam();
      W.shake(0.2);
      this.setDown(this.downFace, 0.5);
      return;
    }
    this.dive = null;
    let victim: Wrestler | null = null;
    let bd = 1.0;
    for (const o of W.wrestlers) {
      if (o === this || o.eliminated || o.inRing !== this.inRing) continue;
      const lv = o.level();
      if (lv !== 'stand' && lv !== 'down') continue;
      const d = this.distTo(o);
      if (d < bd || (o === air.target && d < 1.3)) {
        bd = d;
        victim = o;
      }
    }
    audio.slam();
    W.shake(0.3);
    if (victim) {
      victim.hurt(air.dmg, this, W);
      this.rig.worldHead(tmpV);
      W.sparks(tmpV, 8);
      W.excite(0.8);
      audio.pop(0.9);
      const names: Record<string, string> = { cross: 'Crossbody', splash: 'Splash', elbow: 'Elbow Drop', legdrop: 'Leg Drop' };
      W.say(`${names[air.kind]} by ${this.name}!`, this.profile.colour);
      if (victim.level() === 'stand') victim.knockDown(this, W, false, 2);
      else if (victim.state === 'down') victim.downT += 1.2;
      this.setDown(air.kind === 'legdrop' ? 'back' : 'front', -10);
      this.downT = 0.45;
    } else {
      this.hurt(7, null, W);
      W.say(`${this.name} crashes and burns!`);
      W.excite(0.4);
      this.setDown(air.kind === 'legdrop' ? 'back' : 'front', 0.6);
    }
  }

  /** Called by links when a move ends. */
  endIn(state: 'stand' | 'stagger' | 'gut' | 'back' | 'front' | 'sit' | 'hold', extraDown = 0) {
    this.normalise();
    this.link = null;
    switch (state) {
      case 'stand':
        this.setState('idle');
        break;
      case 'stagger':
        this.hurtKind = 'high';
        this.hurtDur = 0.6;
        this.setState('hurt');
        break;
      case 'gut':
        this.hurtKind = 'gut';
        this.hurtDur = 0.9;
        this.setState('hurt');
        break;
      case 'back':
      case 'front':
        this.setDown(state, extraDown);
        break;
      case 'sit':
        this.downFace = 'back';
        this.setState('getup');
        this.st = 0.3;
        break;
      case 'hold':
        break;
    }
  }
}
