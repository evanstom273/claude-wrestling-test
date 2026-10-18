import * as THREE from 'three';
import { RING, PLAY_HALF, clamp, inRingFootprint, smooth } from './constants';
import { Rig, type Look } from './Rig';
import { POSE_LEN, blendToward, lerpPose, normalisePelvis, type PoseArr } from './pose';
import * as K from './poses';

export type AirLand = 'back' | 'front' | 'stand' | 'dive';

export interface AirPath {
  from: THREE.Vector3;
  to: THREE.Vector3;
  dur: number;
  peak: number;
  pose: PoseArr;
  land: AirLand;
  toRing: boolean;
  spin?: number;
}

export interface RopePath {
  kind: 'exit' | 'enter';
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  dur: number;
}

const tmp = new THREE.Vector3();

/** Common body: rig, position, locomotion, ring transitions and ballistic flight. */
export class Fighter {
  rig: Rig;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3(); // horizontal slide (knockback etc.)
  yaw = 0;
  inRing = true;
  target: PoseArr = new Float32Array(POSE_LEN);
  blend = 14;
  walkPhase = 0;
  moveSpeed = 0;
  air: AirPath | null = null;
  airT = 0;
  rope: RopePath | null = null;
  ropeT = 0;
  ropePush = 0; // how long we've been pushing into the ropes / apron
  snapPose = false;

  constructor(look: Look) {
    this.rig = new Rig(look);
    this.target.set(K.STAND);
    this.rig.pose.set(K.STAND);
  }

  get groundY() {
    return this.inRing ? RING.H : 0;
  }

  facingVec(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  faceTowards(x: number, z: number) {
    this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  /** Locomotion pose blending stance -> walk/run cycle. */
  locoPose(dt: number, speed: number, running: boolean, base: PoseArr = K.STANCE) {
    this.moveSpeed = speed;
    if (speed < 0.05) {
      this.target.set(base);
      return;
    }
    this.walkPhase += dt * (running ? 11 : 7.5) * Math.min(1.3, 0.5 + speed / (running ? 6 : 2.5));
    const u = (Math.sin(this.walkPhase) + 1) / 2;
    const A = running ? K.RUN_A : K.WALK_A;
    const B = running ? K.RUN_B : K.WALK_B;
    lerpPose(this.target, A, B, u);
    if (!running) {
      // keep the guard up a bit while walking
      const g = Math.min(1, speed / 2.2);
      for (let i = 4 * 3; i < 8 * 3; i++) this.target[i] += (base[i] - this.target[i]) * 0.5 * g;
    }
    this.target[POSE_LEN - 3] += Math.abs(Math.cos(this.walkPhase)) * (running ? 0.05 : 0.025);
  }

  /** Clamp position to the legal area for the current zone. */
  clampBounds() {
    if (this.inRing) {
      this.pos.x = clamp(this.pos.x, -PLAY_HALF, PLAY_HALF);
      this.pos.z = clamp(this.pos.z, -PLAY_HALF, PLAY_HALF);
    } else {
      const F = RING.floor;
      this.pos.x = clamp(this.pos.x, -F, F);
      this.pos.z = clamp(this.pos.z, -F, F);
      const m = RING.apron + 0.32;
      if (Math.abs(this.pos.x) < m && Math.abs(this.pos.z) < m) {
        // push out along the shallowest axis
        const dx = m - Math.abs(this.pos.x);
        const dz = m - Math.abs(this.pos.z);
        if (dx < dz) this.pos.x = Math.sign(this.pos.x || 1) * m;
        else this.pos.z = Math.sign(this.pos.z || 1) * m;
      }
    }
  }

  /** Is the given world-space direction pushing out through the ropes from here? Returns outward normal or null. */
  ropeExitNormal(dx: number, dz: number): THREE.Vector3 | null {
    if (!this.inRing) return null;
    const edge = PLAY_HALF - 0.12;
    const corner = PLAY_HALF - 0.3;
    if (this.pos.x > edge && dx > 0.75 && Math.abs(this.pos.z) < corner) return new THREE.Vector3(1, 0, 0);
    if (this.pos.x < -edge && dx < -0.75 && Math.abs(this.pos.z) < corner) return new THREE.Vector3(-1, 0, 0);
    if (this.pos.z > edge && dz > 0.75 && Math.abs(this.pos.x) < corner) return new THREE.Vector3(0, 0, 1);
    if (this.pos.z < -edge && dz < -0.75 && Math.abs(this.pos.x) < corner) return new THREE.Vector3(0, 0, -1);
    return null;
  }

  /** From the floor, is the direction pushing into the apron? Returns inward normal (pointing into ring) or null. */
  ropeEnterNormal(dx: number, dz: number): THREE.Vector3 | null {
    if (this.inRing) return null;
    const near = RING.apron + 0.6;
    const corner = RING.apron - 0.15;
    const ax = Math.abs(this.pos.x);
    const az = Math.abs(this.pos.z);
    if (ax < near && az < corner && ax > az) {
      const s = Math.sign(this.pos.x);
      if (dx * s < -0.75) return new THREE.Vector3(-s, 0, 0);
    }
    if (az < near && ax < corner && az > ax) {
      const s = Math.sign(this.pos.z);
      if (dz * s < -0.75) return new THREE.Vector3(0, 0, -s);
    }
    return null;
  }

  startRopeExit(n: THREE.Vector3) {
    const a = this.pos.clone();
    a.y = RING.H;
    const b = a.clone();
    if (n.x) b.x = n.x * (RING.apron - 0.15);
    else b.z = n.z * (RING.apron - 0.15);
    const c = b.clone();
    if (n.x) c.x = n.x * (RING.apron + 0.7);
    else c.z = n.z * (RING.apron + 0.7);
    c.y = 0;
    this.rope = { kind: 'exit', a, b, c, dur: 1.0 };
    this.ropeT = 0;
    this.yaw = Math.atan2(n.x, n.z);
  }

  startRopeEnter(n: THREE.Vector3) {
    const a = this.pos.clone();
    a.y = 0;
    const b = a.clone();
    if (n.x) b.x = -n.x * (RING.apron - 0.1);
    else b.z = -n.z * (RING.apron - 0.1);
    b.y = RING.H;
    const c = b.clone();
    if (n.x) {
      c.x = -n.x * (PLAY_HALF - 0.15);
      b.z = c.z = clamp(b.z, -PLAY_HALF + 0.35, PLAY_HALF - 0.35);
    } else {
      c.z = -n.z * (PLAY_HALF - 0.15);
      b.x = c.x = clamp(b.x, -PLAY_HALF + 0.35, PLAY_HALF - 0.35);
    }
    this.rope = { kind: 'enter', a, b, c, dur: 1.05 };
    this.ropeT = 0;
    this.yaw = Math.atan2(n.x, n.z);
  }

  /** Advance a rope transition; returns true when finished. */
  updateRope(dt: number): boolean {
    const r = this.rope!;
    this.ropeT += dt;
    const u = Math.min(1, this.ropeT / r.dur);
    const split = r.kind === 'exit' ? 0.45 : 0.45;
    if (u < split) {
      const v = smooth(u / split);
      this.pos.lerpVectors(r.a, r.b, v);
      if (r.kind === 'enter') this.pos.y = r.a.y + (r.b.y - r.a.y) * Math.min(1, v * 1.4);
      this.target.set(r.kind === 'exit' ? K.THROUGH_ROPES : K.CLIMB);
    } else {
      const v = (u - split) / (1 - split);
      this.pos.lerpVectors(r.b, r.c, smooth(v));
      if (r.kind === 'exit') {
        this.pos.y = r.b.y + (r.c.y - r.b.y) * v * v + Math.sin(v * Math.PI) * 0.25;
        this.target.set(v < 0.7 ? K.JUMP_DOWN : K.STANCE);
      } else {
        this.inRing = true;
        this.target.set(v < 0.6 ? K.THROUGH_ROPES : K.STANCE);
      }
    }
    if (u >= 1) {
      this.pos.copy(r.c);
      this.inRing = r.kind === 'enter';
      this.pos.y = this.groundY;
      this.rope = null;
      this.ropePush = 0;
      this.clampBounds();
      return true;
    }
    return false;
  }

  launch(to: THREE.Vector3, dur: number, peak: number, pose: PoseArr, land: AirLand, toRing: boolean, spin = 0) {
    this.air = { from: this.pos.clone(), to: to.clone(), dur, peak, pose, land, toRing, spin };
    this.airT = 0;
    this.vel.set(0, 0, 0);
  }

  /** Advance flight; returns true on landing. */
  updateAir(dt: number): boolean {
    const a = this.air!;
    this.airT += dt;
    const u = Math.min(1, this.airT / a.dur);
    this.pos.x = a.from.x + (a.to.x - a.from.x) * u;
    this.pos.z = a.from.z + (a.to.z - a.from.z) * u;
    this.pos.y = a.from.y + (a.to.y - a.from.y) * u + 4 * a.peak * u * (1 - u);
    this.target.set(a.pose);
    if (a.spin) this.target[0] += a.spin * u;
    if (u >= 1) {
      this.inRing = a.toRing;
      this.pos.y = this.groundY;
      this.air = null;
      return true;
    }
    return false;
  }

  /** Copy the target pose straight onto the rig (no blending) this frame. */
  snap() {
    this.snapPose = true;
  }

  applyRig(dt: number) {
    if (this.snapPose) {
      this.rig.pose.set(this.target);
      this.snapPose = false;
    } else {
      blendToward(this.rig.pose, this.target, 1 - Math.exp(-this.blend * dt));
    }
    this.rig.apply();
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
  }

  normalise() {
    normalisePelvis(this.rig.pose);
    normalisePelvis(this.target);
  }

  isOverRingFootprint() {
    return inRingFootprint(this.pos.x, this.pos.z);
  }

  distTo(o: Fighter) {
    return Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
  }

  /** Cosine of angle between facing and direction to other. */
  facingDot(o: Fighter) {
    tmp.set(o.pos.x - this.pos.x, 0, o.pos.z - this.pos.z).normalize();
    return tmp.x * Math.sin(this.yaw) + tmp.z * Math.cos(this.yaw);
  }
}
