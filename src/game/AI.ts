import type { Intent } from './Input';
import type { World } from './types';
import type { Wrestler } from './Wrestler';
import { PLAY_HALF, RING, approachAngle, chance, clamp, pick, rand } from './constants';

type PlanKind = 'return' | 'approach' | 'run' | 'pin' | 'stomp' | 'pickup' | 'sub' | 'climb' | 'weapon' | 'taunt' | 'circle' | 'wait' | 'breakup' | 'throw';

interface Plan {
  kind: PlanKind;
  action?: 'strike' | 'grab' | 'wait';
  until: number;
}

// ?passive=1 makes CPUs stand still (testing aid)
const PASSIVE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('passive') === '1';

export class AI {
  thinkT = 0;
  target: Wrestler | null = null;
  targetT = 0;
  plan: Plan = { kind: 'wait', until: 0 };
  holdDelay = -1;
  perchT = 0;
  circleDir = 1;
  breakups = new WeakMap<object, boolean>();
  diff: number;
  passive = PASSIVE;

  constructor(
    public me: Wrestler,
    difficulty: number,
  ) {
    this.diff = difficulty;
  }

  private get thinkEvery() {
    return 0.55 - this.diff * 0.38;
  }

  private moveTo(out: Intent, x: number, z: number, W: World) {
    const me = this.me;
    let tx = x;
    let tz = z;
    if (!me.inRing) {
      // route around the ring block via a corner
      const m = RING.apron + 0.25;
      const blocked = segBlocked(me.pos.x, me.pos.z, x, z, m);
      if (blocked) {
        let best = Infinity;
        for (const cx of [-1, 1])
          for (const cz of [-1, 1]) {
            const px = cx * (m + 0.7);
            const pz = cz * (m + 0.7);
            const c = Math.hypot(px - me.pos.x, pz - me.pos.z) + Math.hypot(x - px, z - pz);
            if (c < best && !segBlocked(me.pos.x, me.pos.z, px, pz, m - 0.1)) {
              best = c;
              tx = px;
              tz = pz;
            }
          }
      }
    }
    const dx = tx - me.pos.x;
    const dz = tz - me.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    out.mx = dx / d;
    out.my = dz / d;
    void W;
    return Math.hypot(x - me.pos.x, z - me.pos.z);
  }

  /** Walk to the target's zone. Returns true while still navigating. */
  private navigate(out: Intent, t: { x: number; z: number; inRing: boolean }, W: World) {
    const me = this.me;
    if (me.inRing === t.inRing) return false;
    if (me.inRing) {
      // exit on the side nearest to the target
      let ex: number, ez: number, px: number, pz: number;
      if (Math.abs(t.x) > Math.abs(t.z)) {
        ex = Math.sign(t.x) * PLAY_HALF;
        ez = clamp(t.z, -1.7, 1.7);
        px = Math.sign(t.x);
        pz = 0;
      } else {
        ex = clamp(t.x, -1.7, 1.7);
        ez = Math.sign(t.z) * PLAY_HALF;
        px = 0;
        pz = Math.sign(t.z);
      }
      const d = this.moveTo(out, ex, ez, W);
      if (d < 0.25) {
        out.mx = px;
        out.my = pz;
      }
    } else {
      let ex: number, ez: number, px: number, pz: number;
      const ax = Math.abs(me.pos.x);
      const az = Math.abs(me.pos.z);
      if (ax > az) {
        ex = Math.sign(me.pos.x) * (RING.apron + 0.4);
        ez = clamp(me.pos.z, -1.7, 1.7);
        px = -Math.sign(me.pos.x);
        pz = 0;
      } else {
        ex = clamp(me.pos.x, -1.7, 1.7);
        ez = Math.sign(me.pos.z) * (RING.apron + 0.4);
        px = 0;
        pz = -Math.sign(me.pos.z);
      }
      const d = this.moveTo(out, ex, ez, W);
      if (d < 0.3) {
        out.mx = px;
        out.my = pz;
      }
    }
    return true;
  }

  private chooseTarget(W: World) {
    const me = this.me;
    // break up pins and submissions first (if we notice in time)
    for (const L of W.links) {
      if ((L.kind === 'pin' || L.kind === 'sub') && L.atk !== me && L.vic !== me) {
        let go = this.breakups.get(L);
        if (go === undefined) {
          go = me.distTo(L.atk) < 6 && me.inRing === L.atk.inRing && chance(0.35 + this.diff * 0.4);
          this.breakups.set(L, go);
        }
        if (go) return L.atk;
      }
    }
    const opps = W.wrestlers.filter((w) => w !== me && !w.eliminated);
    if (!opps.length) return null;
    if (this.target && !this.target.eliminated && W.time < this.targetT) return this.target;
    this.targetT = W.time + rand(3, 7);
    if (me.attackerOf && opps.includes(me.attackerOf) && chance(0.4)) return me.attackerOf;
    let best = opps[0];
    let bd = Infinity;
    for (const o of opps) {
      const d = me.distTo(o) + (o.inRing !== me.inRing ? 4 : 0) + rand(0, 2);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  update(dt: number, W: World, out: Intent) {
    out.mx = out.my = 0;
    out.attack = out.grab = out.pick = out.taunt = out.run = out.mash = false;
    const me = this.me;
    if (W.over || PASSIVE) return out;
    this.thinkT -= dt;

    switch (me.state) {
      case 'held':
      case 'link':
        if (me.role === 'vic') return out; // struggling is handled by the link
        return out;
      case 'down':
        out.mash = chance(this.diff * 0.06);
        return out;
      case 'holding':
        return this.holding(dt, out, W);
      case 'perch':
        return this.perch(dt, out, W);
      case 'idle':
      case 'run':
        break;
      default:
        return out;
    }

    if (this.thinkT <= 0) {
      this.thinkT = this.thinkEvery * rand(0.7, 1.3);
      this.target = this.chooseTarget(W);
      this.think(W);
    }
    const t = this.target;
    if (!t) return out;
    const p = this.plan;

    if (p.kind === 'weapon') {
      const wpn = W.weapons.find((w) => !w.holder && !w.flying && w.pos.y < 0.5);
      if (!wpn || me.weapon || me.inRing) this.plan = { kind: 'approach', action: 'strike', until: W.time + 3 };
      else {
        const d = this.moveTo(out, wpn.pos.x, wpn.pos.z, W);
        if (d < 0.75) {
          out.mx = out.my = 0;
          out.pick = true;
        }
        return out;
      }
    }

    if (p.kind === 'return') {
      if (me.inRing || W.time > p.until) this.thinkT = 0;
      else {
        this.navigate(out, { x: 0, z: 0, inRing: true }, W);
        return out;
      }
    }

    if (p.kind === 'climb') {
      if (!me.inRing || t.level() !== 'down' || !t.inRing) {
        this.plan = { kind: 'approach', until: W.time + 2 };
      } else {
        const cx = Math.sign(me.pos.x || 1) * (PLAY_HALF - 0.3);
        const cz = Math.sign(me.pos.z || 1) * (PLAY_HALF - 0.3);
        const d = this.moveTo(out, cx, cz, W);
        if (d < 0.35) {
          out.mx = out.my = 0;
          out.pick = true;
          this.perchT = 0;
        }
        return out;
      }
    }

    if (p.kind === 'taunt') {
      out.taunt = true;
      this.plan = { kind: 'wait', until: W.time + 1.6 };
      return out;
    }

    if (p.kind === 'throw' && me.weapon) {
      me.yaw = approachAngle(me.yaw, Math.atan2(t.pos.x - me.pos.x, t.pos.z - me.pos.z), 10 * dt);
      if (me.facingDot(t) > 0.9) {
        out.pick = true;
        this.plan = { kind: 'wait', until: W.time + 0.6 };
      }
      return out;
    }

    // go to where the target is
    if (this.navigate(out, { x: t.pos.x, z: t.pos.z, inRing: t.inRing }, W)) return out;

    const d = me.distTo(t);
    const lv = t.level();
    const toward = Math.atan2(t.pos.x - me.pos.x, t.pos.z - me.pos.z);

    if (me.state === 'run') {
      out.run = true;
      out.mx = Math.sin(toward);
      out.my = Math.cos(toward);
      if (d < (lv === 'down' ? 2.0 : 1.5) && me.facingDot(t) > 0.6) {
        if (lv === 'down' || chance(0.7)) out.attack = true;
        else out.grab = true;
        this.plan = { kind: 'wait', until: W.time + 0.6 };
      }
      if (W.time > p.until || me.facingDot(t) < -0.2) out.run = false;
      return out;
    }

    if (p.kind === 'wait') {
      if (W.time > p.until) this.thinkT = 0;
      if (d < 1.6) me.yaw = approachAngle(me.yaw, toward, 6 * dt);
      return out;
    }

    if (p.kind === 'circle') {
      const side = toward + (Math.PI / 2) * this.circleDir;
      out.mx = Math.sin(side) * 0.6;
      out.my = Math.cos(side) * 0.6;
      if (d > 2.2) {
        out.mx += Math.sin(toward) * 0.5;
        out.my += Math.cos(toward) * 0.5;
      }
      if (W.time > p.until) this.thinkT = 0;
      return out;
    }

    if (p.kind === 'run') {
      if (d > 2.2 && me.inRing) {
        out.mx = Math.sin(toward);
        out.my = Math.cos(toward);
        out.run = true;
        return out;
      }
      this.plan = { kind: 'approach', action: 'strike', until: W.time + 2 };
    }

    // approach plans on standing / downed targets
    const wantDown = p.kind === 'pin' || p.kind === 'stomp' || p.kind === 'pickup' || p.kind === 'sub';
    if (wantDown && lv !== 'down') {
      this.thinkT = 0;
      this.plan = { kind: 'approach', action: 'strike', until: W.time + 2 };
      return out;
    }
    const range = p.kind === 'pin' ? 1.1 : wantDown ? 1.0 : p.action === 'grab' ? 0.95 : me.weapon ? 1.2 : 1.0;
    if (d > range) {
      this.moveTo(out, t.pos.x, t.pos.z, W);
      // lining up for a whipped opponent: wait for them to come back
      if (t.state === 'whipped' && d < 4) {
        out.mx = out.my = 0;
        me.yaw = approachAngle(me.yaw, toward, 8 * dt);
        if (d < 1.6 && t.facingDot(me) > 0.5) {
          if (chance(0.5)) out.attack = true;
          else out.grab = true;
        }
      }
      if (W.time > p.until) this.thinkT = 0;
      return out;
    }
    me.yaw = approachAngle(me.yaw, toward, 14 * dt);
    if (me.facingDot(t) < 0.5 && !wantDown) return out;
    switch (p.kind) {
      case 'pin':
        out.pick = true;
        break;
      case 'stomp':
        out.attack = true;
        if (chance(0.35)) this.plan = { kind: 'wait', until: W.time + 0.3 };
        break;
      case 'pickup':
        out.grab = true;
        break;
      case 'sub':
        out.grab = true;
        out.mx = Math.sin(toward) * 0.5;
        out.my = Math.cos(toward) * 0.5;
        break;
      case 'breakup':
        out.attack = true;
        break;
      default:
        if (p.action === 'grab' && !me.weapon) out.grab = true;
        else if (p.action === 'wait') {
          this.plan = { kind: 'circle', until: W.time + rand(0.4, 1.0) };
          this.circleDir = chance(0.5) ? 1 : -1;
        } else {
          out.attack = true;
          // occasionally string a combo together
          if (chance(0.5)) this.plan.until = W.time + 0.5;
          else this.thinkT = 0;
        }
    }
    if (p.kind !== 'approach' && p.kind !== 'stomp') this.plan = { kind: 'wait', until: W.time + 0.5 };
    return out;
  }

  private think(W: World) {
    const me = this.me;
    const t = this.target;
    if (!t) {
      this.plan = { kind: 'taunt', until: W.time + 1 };
      return;
    }
    // someone else is pinning / submitting: stop them
    if (t.link && t.role === 'atk' && (t.link.kind === 'pin' || t.link.kind === 'sub') && t.link.vic !== me && this.breakups.get(t.link)) {
      this.plan = { kind: 'breakup', until: W.time + 3 };
      return;
    }
    if (this.plan.kind === 'wait' && W.time < this.plan.until) return;
    if (this.plan.kind === 'return' && !me.inRing && W.time < this.plan.until) return;
    const lv = t.level();
    // don't brawl on the floor all night
    if (!me.inRing && !me.weapon && lv !== 'down' && chance(0.12)) {
      this.plan = { kind: 'return', until: W.time + 6 };
      return;
    }
    const d = me.distTo(t);
    const style = me.profile.style;
    if (me.weapon) {
      if (d > 3 && chance(0.25)) this.plan = { kind: 'throw', until: W.time + 2 };
      else this.plan = { kind: 'approach', action: 'strike', until: W.time + 3 };
      return;
    }
    if (lv === 'down') {
      const finishing = t.hp < 30 + rand(0, 30) * (1 - this.diff * 0.3);
      if (finishing && chance(0.65)) {
        this.plan = { kind: 'pin', until: W.time + 3 };
        return;
      }
      const opts: [PlanKind, number][] = [
        ['stomp', 3],
        ['pickup', t.hp > 40 ? 3 : 1.5],
        ['sub', style === 'technician' ? 3 : 1.2],
        ['climb', style === 'highflyer' ? 3 : 1],
        ['taunt', me.spirit < 100 ? 1.5 : 0.3],
        ['pin', t.hp < 60 ? 1.5 : 0.3],
      ];
      if (!me.inRing && W.weapons.some((w) => !w.holder && !w.flying && w.pos.y < 0.5)) opts.push(['weapon', style === 'hardcore' ? 3 : 1]);
      if (!me.inRing || !t.inRing) opts.splice(3, 1);
      this.plan = { kind: weighted(opts), until: W.time + 3 };
      return;
    }
    if (lv === 'perch') {
      this.plan = { kind: 'approach', action: 'strike', until: W.time + 3 };
      return;
    }
    if (t.state === 'slump' && me.inRing && d > 1.6) {
      this.plan = { kind: 'run', until: W.time + 2 };
      return;
    }
    if (!me.inRing && chance(style === 'hardcore' ? 0.3 : 0.1) && W.weapons.some((w) => !w.holder && !w.flying && w.pos.y < 0.5)) {
      this.plan = { kind: 'weapon', until: W.time + 4 };
      return;
    }
    if (me.inRing && t.inRing && d > 3.2 && chance(0.35)) {
      this.plan = { kind: 'run', until: W.time + 2 };
      return;
    }
    if (d > 4 && me.spirit < 100 && chance(0.15)) {
      this.plan = { kind: 'taunt', until: W.time + 1 };
      return;
    }
    const grabW = style === 'powerhouse' || style === 'technician' ? 5 : 4;
    const strikeW = style === 'brawler' || style === 'hardcore' ? 5 : 3.5;
    const waitW = 4 - this.diff * 3.5;
    const gut = t.state === 'hurt' && t.hurtKind === 'gut' ? 4 : 0;
    const action = weighted<'strike' | 'grab' | 'wait'>([
      ['strike', strikeW],
      ['grab', grabW + gut],
      ['wait', waitW],
    ]);
    this.plan = { kind: 'approach', action, until: W.time + 2.5 };
  }

  private holding(dt: number, out: Intent, W: World) {
    const me = this.me;
    if (this.holdDelay < 0) this.holdDelay = rand(0.35, 1.1) * (1.25 - this.diff * 0.45);
    this.holdDelay -= dt;
    if (this.holdDelay > 0) return out;
    this.holdDelay = -1;
    const behind = me.link?.behind;
    if (me.special) {
      out.taunt = true;
      return out;
    }
    const r = Math.random();
    const f = me.facingVec();
    if (!behind && r < 0.14 && me.inRing) {
      out.run = true;
      // whip toward the far ropes or a corner
      const opts = [
        [f.x, f.z],
        [-me.pos.x, -me.pos.z],
        [Math.sign(f.x || 1), Math.sign(f.z || 1)],
      ];
      const [x, z] = pick(opts);
      const l = Math.hypot(x, z) || 1;
      out.mx = x / l;
      out.my = z / l;
      return out;
    }
    if (!behind && r < 0.2 && !me.inRing) {
      out.run = true;
      out.mx = f.x;
      out.my = f.z;
      return out;
    }
    const dir = chance(0.5);
    if (dir) {
      out.mx = f.x;
      out.my = f.z;
    }
    if (chance(0.45)) out.attack = true;
    else out.grab = true;
    void W;
    return out;
  }

  private perch(dt: number, out: Intent, W: World) {
    const me = this.me;
    this.perchT += dt;
    const t = this.target;
    if (this.perchT > 0.5 && t && t.inRing && me.distTo(t) < 4.5 && (t.level() === 'down' || t.level() === 'stand')) {
      if (t.level() === 'down' || chance(0.4)) out.attack = true;
    }
    if (this.perchT > 0.8 && this.perchT < 1.2 && me.spirit < 100) out.taunt = chance(0.05);
    if (this.perchT > 3) out.pick = true;
    void W;
    return out;
  }
}

function weighted<T>(opts: [T, number][]): T {
  const total = opts.reduce((a, o) => a + Math.max(0, o[1]), 0);
  let r = Math.random() * total;
  for (const [v, w] of opts) {
    r -= Math.max(0, w);
    if (r <= 0) return v;
  }
  return opts[0][0];
}

/** Does the segment from a to b pass through the square of half-size m? */
function segBlocked(ax: number, az: number, bx: number, bz: number, m: number) {
  for (let i = 1; i < 10; i++) {
    const u = i / 10;
    const x = ax + (bx - ax) * u;
    const z = az + (bz - az) * u;
    if (Math.abs(x) < m && Math.abs(z) < m) return true;
  }
  return false;
}
