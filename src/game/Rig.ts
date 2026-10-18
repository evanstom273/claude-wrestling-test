import * as THREE from 'three';
import { JOINTS, type Joint, type PoseArr, POSE_LEN, POSE_IDX } from './pose';

export type HairStyle = 'bald' | 'short' | 'long' | 'mohawk' | 'ponytail' | 'spiky' | 'afro';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  beard?: string;
  mask?: { color: string; accent: string };
  trunks: string;
  legwear: 'briefs' | 'shorts' | 'tights' | 'trousers';
  legAccent?: string;
  boots: string;
  kneepads?: string;
  top?: string;
  topStyle?: 'tank' | 'singlet' | 'stripes' | 'jacket';
  wrist?: string;
  facepaint?: string;
  height: number;
  bulk: number;
  gut: number;
  female?: boolean;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g as T;
}

const matCache = new Map<string, THREE.Material>();
function mat(color: string, rough = 0.75, metal = 0) {
  const key = `${color}|${rough}|${metal}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true });
    matCache.set(key, m);
  }
  return m;
}

let stripeMat: THREE.Material | null = null;
function stripes() {
  if (stripeMat) return stripeMat;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#111' : '#f4f4f4';
    g.fillRect(i * 8, 0, 8, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  stripeMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, flatShading: true });
  return stripeMat;
}

function capsule(r: number, len: number) {
  return cached(`cap${r.toFixed(3)}_${len.toFixed(3)}`, () => new THREE.CapsuleGeometry(r, len, 3, 8));
}
function cyl(rt: number, rb: number, h: number, seg = 10) {
  return cached(`cyl${rt.toFixed(3)}_${rb.toFixed(3)}_${h.toFixed(3)}_${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
}
function sphere(r: number, ws = 10, hs = 8, thetaLen = Math.PI) {
  return cached(`sph${r.toFixed(3)}_${ws}_${hs}_${thetaLen.toFixed(2)}`, () => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, thetaLen));
}
function box(w: number, h: number, d: number) {
  return cached(`box${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d));
}

export class Rig {
  root = new THREE.Group();
  joints = {} as Record<Joint, THREE.Group>;
  pose: PoseArr = new Float32Array(POSE_LEN);
  handR = new THREE.Group();
  handL = new THREE.Group();
  head = new THREE.Group();
  meshes: THREE.Mesh[] = [];

  constructor(public look: Look) {
    const L = look;
    const b = L.bulk;
    const fem = !!L.female;
    const skin = mat(L.skin, 0.55);
    const trunks = mat(L.trunks, 0.5, 0.1);
    const boots = mat(L.boots, 0.45, 0.1);
    const topMat = L.topStyle === 'stripes' ? stripes() : L.top ? mat(L.top, 0.6) : skin;
    const legMat = L.legwear === 'tights' || L.legwear === 'trousers' ? trunks : skin;
    const thighMat = L.legwear === 'briefs' ? skin : trunks;

    for (const j of JOINTS) {
      const g = new THREE.Group();
      g.name = j;
      this.joints[j] = g;
    }
    const J = this.joints;
    this.root.add(J.pelvis);

    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      parent.add(mesh);
      this.meshes.push(mesh);
      return mesh;
    };

    // Pelvis / trunks
    const hipW = (fem ? 0.165 : 0.155) * b;
    add(J.pelvis, cyl(hipW * 0.98, hipW, 0.2), trunks, 0, 0.0, 0, 1, 1, 0.72);
    if (L.legAccent) add(J.pelvis, cyl(hipW * 1.0, hipW * 1.0, 0.04), mat(L.legAccent, 0.5), 0, 0.09, 0, 1, 1, 0.73);

    // Spine / abdomen
    J.pelvis.add(J.spine);
    J.spine.position.set(0, 0.08, 0);
    const absMat = L.top && L.topStyle !== 'tank' ? topMat : L.top && L.topStyle === 'tank' ? topMat : skin;
    add(J.spine, cyl(0.15 * b, (0.155 + L.gut * 0.03) * b, 0.26), absMat, 0, 0.12, 0.01 + L.gut * 0.03, 1, 1, 0.72 + L.gut * 0.25);

    // Chest
    J.spine.add(J.chest);
    J.chest.position.set(0, 0.24, 0);
    const shoulderW = (fem ? 0.175 : 0.215) * b;
    const chestMesh = add(J.chest, cyl(shoulderW, 0.155 * b, 0.32, 8), L.top ? topMat : skin, 0, 0.15, 0, 1, 1, 0.62);
    chestMesh.rotation.y = Math.PI / 8;
    if (fem) add(J.chest, sphere(0.07 * b, 8, 6), L.top ? topMat : trunks, 0, 0.14, 0.085 * b, 1.9, 0.75, 0.75);
    else if (!L.top) {
      // pecs
      add(J.chest, box(0.27 * b, 0.1, 0.06), skin, 0, 0.19, 0.09 * b);
    }
    if (L.topStyle === 'jacket') {
      add(J.chest, box(0.06, 0.3, 0.02), mat('#111'), 0.0, 0.15, 0.11 * b);
    }

    // Neck + head
    J.chest.add(J.neck);
    J.neck.position.set(0, 0.31, 0);
    add(J.neck, cyl(0.06 * Math.max(1, b * 0.95), 0.07 * Math.max(1, b * 0.95), 0.12), skin, 0, 0.04, 0);
    J.neck.add(this.head);
    this.head.position.set(0, 0.17, 0);
    const headMat = L.mask ? mat(L.mask.color, 0.4) : skin;
    add(this.head, sphere(0.12, 12, 10), headMat, 0, 0, 0, 0.95, 1.12, 1.05);
    // jaw / chin
    add(this.head, box(0.13, 0.07, 0.12), headMat, 0, -0.08, 0.035);
    // eyes
    const eyeM = mat('#141414', 0.3);
    const eyeWhite = mat(L.mask ? L.mask.accent : '#f2efe9', 0.4);
    for (const s of [-1, 1]) {
      if (L.mask) add(this.head, box(0.06, 0.04, 0.02), eyeWhite, s * 0.045, 0.02, 0.115);
      add(this.head, box(0.025, 0.022, 0.02), eyeM, s * 0.042, 0.02, 0.122);
      add(this.head, box(0.045, 0.012, 0.02), mat(L.mask ? L.mask.accent : L.hair === 'none' ? '#333' : L.hair, 0.6), s * 0.045, 0.05, 0.118);
    }
    add(this.head, box(0.05, 0.012, 0.02), mat(L.mask ? '#111' : '#5a2b2b'), 0, -0.07, 0.1);
    if (L.facepaint) {
      for (const s of [-1, 1]) add(this.head, box(0.018, 0.08, 0.02), mat(L.facepaint, 0.4), s * 0.045, -0.015, 0.123);
    }
    if (L.mask) {
      add(this.head, box(0.03, 0.02, 0.24), mat(L.mask.accent, 0.4), 0, 0.125, 0.0);
      add(this.head, box(0.13, 0.02, 0.02), mat(L.mask.accent, 0.4), 0, 0.075, 0.118);
    }
    // Hair
    const hairM = mat(L.hair, 0.85);
    const hs = L.hairStyle;
    if (!L.mask) {
      if (hs === 'short' || hs === 'long' || hs === 'ponytail') {
        add(this.head, sphere(0.128, 12, 8, Math.PI * 0.52), hairM, 0, 0.02, -0.012, 0.98, 1.12, 1.07);
      }
      if (hs === 'long') {
        add(this.head, box(0.25, 0.32, 0.08), hairM, 0, -0.1, -0.09);
        add(this.head, box(0.04, 0.24, 0.12), hairM, 0.11, -0.06, -0.02);
        add(this.head, box(0.04, 0.24, 0.12), hairM, -0.11, -0.06, -0.02);
      }
      if (hs === 'ponytail') {
        const pt = add(this.head, capsule(0.04, 0.22), hairM, 0, -0.06, -0.17);
        pt.rotation.x = 0.4;
      }
      if (hs === 'mohawk') add(this.head, box(0.045, 0.1, 0.26), hairM, 0, 0.12, -0.01);
      if (hs === 'spiky') {
        add(this.head, sphere(0.126, 12, 8, Math.PI * 0.45), hairM, 0, 0.02, -0.01, 0.98, 1.12, 1.07);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const c = add(this.head, cached('spike', () => new THREE.ConeGeometry(0.035, 0.11, 5)), hairM, Math.cos(a) * 0.06, 0.13, Math.sin(a) * 0.06 - 0.01);
          c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
        }
      }
      if (hs === 'afro') add(this.head, sphere(0.17, 10, 8), hairM, 0, 0.06, -0.03, 1, 0.95, 1);
    }
    if (L.beard && !L.mask) add(this.head, box(0.15, 0.09, 0.07), mat(L.beard, 0.9), 0, -0.09, 0.07);

    // Arms
    const armR = (fem ? 0.047 : 0.058) * Math.sqrt(b);
    for (const side of [1, -1]) {
      const sh = side === 1 ? J.lArm : J.rArm;
      const el = side === 1 ? J.lElbow : J.rElbow;
      J.chest.add(sh);
      sh.position.set(side * (shoulderW + 0.035), 0.27, 0);
      add(sh, sphere(armR * 1.35, 8, 6), L.topStyle === 'singlet' || L.topStyle === 'jacket' ? topMat : skin, 0, -0.01, 0);
      add(sh, capsule(armR, 0.2), L.topStyle === 'jacket' ? topMat : skin, 0, -0.14, 0);
      sh.add(el);
      el.position.set(0, -0.29, 0);
      add(el, capsule(armR * 0.85, 0.18), L.topStyle === 'jacket' ? topMat : skin, 0, -0.13, 0);
      if (L.wrist) add(el, cyl(armR * 1.05, armR * 1.05, 0.07), mat(L.wrist, 0.6), 0, -0.21, 0);
      const hand = side === 1 ? this.handL : this.handR;
      el.add(hand);
      hand.position.set(0, -0.3, 0);
      add(hand, sphere(armR * 1.1, 8, 6), L.topStyle === 'jacket' ? mat('#222') : skin, 0, 0, 0, 1, 1.2, 1);
    }

    // Legs
    const legR = (fem ? 0.072 : 0.082) * Math.sqrt(b);
    for (const side of [1, -1]) {
      const hip = side === 1 ? J.lLeg : J.rLeg;
      const kn = side === 1 ? J.lKnee : J.rKnee;
      J.pelvis.add(hip);
      hip.position.set(side * 0.09 * b, -0.06, 0);
      add(hip, capsule(legR, 0.26), thighMat, 0, -0.2, 0);
      if (L.legwear === 'shorts') add(hip, cyl(legR * 1.25, legR * 1.15, 0.2), trunks, 0, -0.1, 0);
      hip.add(kn);
      kn.position.set(0, -0.44, 0);
      if (L.kneepads) add(kn, sphere(legR * 1.05, 8, 6), mat(L.kneepads, 0.5), 0, 0.0, 0.015, 1, 1.1, 1);
      add(kn, capsule(legR * 0.78, 0.28), legMat, 0, -0.19, 0);
      add(kn, cyl(legR * 0.92, legR * 0.88, 0.2), boots, 0, -0.33, 0);
      add(kn, box(legR * 1.6, 0.075, 0.24), boots, 0, -0.455, 0.05);
    }
    this.root.scale.setScalar(L.height);
    this.apply();
  }

  apply() {
    const p = this.pose;
    JOINTS.forEach((j, i) => {
      this.joints[j].rotation.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    });
    this.joints.pelvis.position.set(p[POSE_IDX.PX], p[POSE_IDX.PH], p[POSE_IDX.PZ]);
  }

  setHighlight(on: boolean) {
    for (const m of this.meshes) {
      const mm = m.material as THREE.MeshStandardMaterial;
      void mm;
    }
    void on;
  }

  worldHead(out: THREE.Vector3) {
    return this.head.getWorldPosition(out);
  }
}
