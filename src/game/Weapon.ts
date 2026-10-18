import * as THREE from 'three';
import { GRAVITY, RING, inRingFootprint } from './constants';
import type { Wrestler } from './Wrestler';

export type WeaponKind = 'chair' | 'bin' | 'kendo';

function buildMesh(kind: WeaponKind) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#8d9099', metalness: 0.75, roughness: 0.35, flatShading: true });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  if (kind === 'chair') {
    // modelled folded-ish so it reads well when swung; origin at the grip
    add(new THREE.BoxGeometry(0.42, 0.04, 0.4), metal, 0, -0.45, 0.06);
    add(new THREE.BoxGeometry(0.42, 0.42, 0.04), metal, 0, -0.2, -0.13);
    for (const sx of [-0.19, 0.19]) {
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.8), metal, sx, -0.45, 0.0, 0.25);
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.8), metal, sx, -0.45, 0.05, -0.25);
    }
  } else if (kind === 'bin') {
    add(new THREE.CylinderGeometry(0.22, 0.19, 0.6, 10, 1, true), new THREE.MeshStandardMaterial({ color: '#7b8088', metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide, flatShading: true }), 0, -0.35, 0);
    add(new THREE.TorusGeometry(0.22, 0.015, 4, 12), metal, 0, -0.05, 0, Math.PI / 2);
  } else {
    add(new THREE.CylinderGeometry(0.02, 0.025, 1.0, 6), new THREE.MeshStandardMaterial({ color: '#c8a46a', roughness: 0.7 }), 0, -0.35, 0);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), new THREE.MeshStandardMaterial({ color: '#222' }), 0, 0.05, 0);
  }
  return g;
}

export class Weapon {
  mesh: THREE.Group;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  spin = 0;
  holder: Wrestler | null = null;
  thrower: Wrestler | null = null;
  flying = false;
  restY = 0;

  constructor(
    public kind: WeaponKind,
    public scene: THREE.Scene,
    x: number,
    z: number,
  ) {
    this.mesh = buildMesh(kind);
    this.pos.set(x, 0, z);
    this.restY = 0;
    scene.add(this.mesh);
    this.layOnGround();
  }

  get name() {
    return this.kind === 'chair' ? 'steel chair' : this.kind === 'bin' ? 'bin lid' : 'kendo stick';
  }
  get dmg() {
    return this.kind === 'chair' ? 12 : this.kind === 'bin' ? 9 : 8;
  }

  groundAt(x: number, z: number) {
    return inRingFootprint(x, z) ? RING.H : 0;
  }

  layOnGround() {
    this.mesh.position.set(this.pos.x, this.pos.y + 0.05, this.pos.z);
    this.mesh.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI);
  }

  attach(w: Wrestler) {
    this.holder = w;
    this.flying = false;
    w.rig.handR.add(this.mesh);
    this.mesh.position.set(0, 0.0, 0);
    this.mesh.rotation.set(0, 0, 0);
  }

  drop(throwVel?: THREE.Vector3) {
    if (!this.holder) return;
    const w = this.holder;
    w.rig.handR.getWorldPosition(this.pos);
    this.scene.add(this.mesh);
    this.holder = null;
    this.flying = true;
    if (throwVel) {
      this.vel.copy(throwVel);
      this.thrower = w;
      this.spin = 12;
    } else {
      this.vel.set((Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2);
      this.thrower = null;
      this.spin = 5;
    }
  }

  update(dt: number) {
    if (this.holder || !this.flying) return;
    this.vel.y -= GRAVITY * dt;
    this.pos.addScaledVector(this.vel, dt);
    const lim = RING.floor + 0.3;
    if (Math.abs(this.pos.x) > lim) (this.pos.x = Math.sign(this.pos.x) * lim), (this.vel.x *= -0.4);
    if (Math.abs(this.pos.z) > lim) (this.pos.z = Math.sign(this.pos.z) * lim), (this.vel.z *= -0.4);
    const gy = this.groundAt(this.pos.x, this.pos.z);
    // bounce off the side of the ring block when coming from the floor
    if (this.pos.y < RING.H - 0.05 && inRingFootprint(this.pos.x, this.pos.z) && this.pos.y > 0.05) {
      if (Math.abs(this.pos.x) > Math.abs(this.pos.z)) this.pos.x = Math.sign(this.pos.x) * (RING.apron + 0.02);
      else this.pos.z = Math.sign(this.pos.z) * (RING.apron + 0.02);
      this.vel.x *= -0.3;
      this.vel.z *= -0.3;
    }
    if (this.pos.y <= this.groundAt(this.pos.x, this.pos.z) && this.vel.y < 0) {
      this.pos.y = gy;
      if (Math.abs(this.vel.y) > 3) {
        this.vel.y *= -0.3;
        this.vel.x *= 0.5;
        this.vel.z *= 0.5;
      } else {
        this.flying = false;
        this.thrower = null;
        this.layOnGround();
        return;
      }
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.x += this.spin * dt;
    this.mesh.rotation.z += this.spin * 0.4 * dt;
  }
}
