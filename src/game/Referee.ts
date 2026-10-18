import * as THREE from 'three';
import { Fighter } from './Fighter';
import { REF_LOOK } from './roster';
import { PLAY_HALF, RING, approachAngle, clamp } from './constants';
import type { World } from './types';
import type { Wrestler } from './Wrestler';
import * as K from './poses';

const tmp = new THREE.Vector3();

export class Referee extends Fighter {
  mode: 'walk' | 'count' | 'check' | 'signal' | 'rope' = 'walk';
  goal = new THREE.Vector3();
  winner: Wrestler | null = null;
  patrolT = 0;
  patrolAngle = Math.PI;

  constructor() {
    super(REF_LOOK);
  }

  update(dt: number, W: World) {
    if (this.mode === 'rope') {
      if (this.updateRope(dt)) this.mode = 'walk';
      this.applyRig(dt);
      return;
    }
    const pin = W.links.find((l) => l.kind === 'pin');
    const sub = W.links.find((l) => l.kind === 'sub');
    let wantRing = true;
    let speed = 2.6;
    let close = 0.35;
    let focus: Wrestler | null = null;
    if (this.winner) {
      focus = this.winner;
      wantRing = this.winner.inRing;
      tmp.set(this.winner.pos.x - this.pos.x, 0, this.winner.pos.z - this.pos.z);
      const side = tmp.set(Math.cos(this.winner.yaw), 0, -Math.sin(this.winner.yaw)).multiplyScalar(0.62);
      this.goal.copy(this.winner.pos).add(side);
      close = 0.25;
    } else if (pin) {
      focus = pin.vic;
      wantRing = pin.vic.inRing;
      tmp.set(0, 0, -1.3).applyAxisAngle(THREE.Object3D.DEFAULT_UP, pin.vic.yaw);
      this.goal.copy(pin.vic.pos).add(tmp);
      speed = 6;
      close = 0.5;
    } else if (sub) {
      focus = sub.vic;
      wantRing = sub.vic.inRing;
      tmp.set(1.2, 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, sub.vic.yaw);
      this.goal.copy(sub.vic.pos).add(tmp);
      speed = 3.5;
    } else {
      // keep out of the way, on the far side of the action from the camera
      const inRing = W.wrestlers.filter((w) => w.inRing && !w.eliminated);
      const c = new THREE.Vector3();
      inRing.forEach((w) => c.add(w.pos));
      if (inRing.length) c.multiplyScalar(1 / inRing.length);
      this.patrolT -= dt;
      if (this.patrolT <= 0) {
        this.patrolT = 2.5;
        this.patrolAngle = Math.PI + (Math.random() - 0.5) * 1.8;
      }
      // stand off toward the open side of the ring, away from the camera side
      const away = Math.hypot(c.x, c.z) > 0.6 ? Math.atan2(-c.x, -c.z) : this.patrolAngle;
      const a = away * 0.6 + this.patrolAngle * 0.4;
      this.goal.set(c.x + Math.sin(a) * 2.4, 0, c.z + Math.cos(a) * 2.4);
      focus = inRing[0] ?? null;
    }
    if (wantRing) {
      this.goal.x = clamp(this.goal.x, -PLAY_HALF, PLAY_HALF);
      this.goal.z = clamp(this.goal.z, -PLAY_HALF, PLAY_HALF);
    }

    // leave/enter the ring when needed
    if (wantRing !== this.inRing) {
      this.navigateZone(dt, wantRing, speed);
      this.mode = 'walk';
      if (pin) pin.refReady = false;
      this.applyRig(dt);
      return;
    }

    const dx = this.goal.x - this.pos.x;
    const dz = this.goal.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > close) {
      const sp = Math.min(speed, d * 4);
      this.pos.x += (dx / d) * sp * dt;
      this.pos.z += (dz / d) * sp * dt;
      this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), 10 * dt);
      this.locoPose(dt, sp, sp > 3.5, K.STAND);
      if (pin) pin.refReady = false;
      this.mode = 'walk';
    } else {
      this.moveSpeed = 0;
      if (focus) this.yaw = approachAngle(this.yaw, Math.atan2(focus.pos.x - this.pos.x, focus.pos.z - this.pos.z), 10 * dt);
      if (this.winner) {
        this.mode = 'signal';
        this.target.set(K.REF_SIGNAL);
      } else if (pin) {
        pin.refReady = true;
        this.mode = 'count';
        this.target.set(pin.countT < 0.16 && pin.count > 0 ? K.REF_SLAP : K.REF_KNEEL);
        this.blend = 22;
      } else if (sub) {
        this.mode = 'check';
        this.target.set(K.REF_CHECK);
      } else {
        this.mode = 'walk';
        this.target.set(K.STAND);
      }
    }
    this.clampBounds();
    this.pos.y = this.groundY;
    this.applyRig(dt);
  }

  private navigateZone(dt: number, wantRing: boolean, speed: number) {
    let tx: number, tz: number, push: THREE.Vector3;
    if (wantRing) {
      // walk to the nearest apron side, then climb in
      if (Math.abs(this.pos.x) > Math.abs(this.pos.z)) {
        tx = Math.sign(this.pos.x) * (RING.apron + 0.45);
        tz = clamp(this.pos.z, -1.6, 1.6);
        push = new THREE.Vector3(-Math.sign(this.pos.x), 0, 0);
      } else {
        tx = clamp(this.pos.x, -1.6, 1.6);
        tz = Math.sign(this.pos.z) * (RING.apron + 0.45);
        push = new THREE.Vector3(0, 0, -Math.sign(this.pos.z));
      }
    } else {
      const g = this.goal;
      if (Math.abs(g.x) > Math.abs(g.z)) {
        tx = Math.sign(g.x) * PLAY_HALF;
        tz = clamp(g.z, -1.6, 1.6);
        push = new THREE.Vector3(Math.sign(g.x), 0, 0);
      } else {
        tx = clamp(g.x, -1.6, 1.6);
        tz = Math.sign(g.z) * PLAY_HALF;
        push = new THREE.Vector3(0, 0, Math.sign(g.z));
      }
    }
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.15) {
      const sp = Math.min(speed, d * 5);
      this.pos.x += (dx / d) * sp * dt;
      this.pos.z += (dz / d) * sp * dt;
      this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), 10 * dt);
      this.locoPose(dt, sp, sp > 3.5, K.STAND);
      this.clampBounds();
      this.pos.y = this.groundY;
    } else {
      if (wantRing) {
        const n = this.ropeEnterNormal(push.x, push.z);
        if (n) this.startRopeEnter(n);
        else this.pos.x += push.x * dt;
      } else {
        const n = this.ropeExitNormal(push.x, push.z);
        if (n) this.startRopeExit(n);
      }
      if (this.rope) this.mode = 'rope';
    }
  }
}
