import * as THREE from 'three';
import { RING } from './constants';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A rope between two posts that can be pushed in at one point and springs back. */
class Rope {
  segA: THREE.Mesh;
  segB: THREE.Mesh;
  mid = new THREE.Vector3();
  push = new THREE.Vector3(); // current displacement
  vel = new THREE.Vector3();
  s = 0.5; // where along the rope the push is applied
  constructor(public a: THREE.Vector3, public b: THREE.Vector3, mat: THREE.Material, parent: THREE.Object3D) {
    const g = new THREE.CylinderGeometry(0.028, 0.028, 1, 6);
    this.segA = new THREE.Mesh(g, mat);
    this.segB = new THREE.Mesh(g, mat);
    this.segA.castShadow = this.segB.castShadow = true;
    parent.add(this.segA, this.segB);
    this.layout();
  }
  layout() {
    this.mid.lerpVectors(this.a, this.b, this.s).add(this.push);
    place(this.segA, this.a, this.mid);
    place(this.segB, this.mid, this.b);
  }
  update(dt: number) {
    // damped spring back to rest
    const k = 140;
    const c = 9;
    this.vel.addScaledVector(this.push, -k * dt).multiplyScalar(Math.max(0, 1 - c * dt));
    this.push.addScaledVector(this.vel, dt);
    this.layout();
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
function place(m: THREE.Mesh, p1: THREE.Vector3, p2: THREE.Vector3) {
  tmpV.subVectors(p2, p1);
  const len = tmpV.length();
  m.position.copy(p1).addScaledVector(tmpV, 0.5);
  m.quaternion.setFromUnitVectors(UP, tmpV.normalize());
  m.scale.set(1, len, 1);
}

export class Arena {
  group = new THREE.Group();
  ropes: { side: 'x+' | 'x-' | 'z+' | 'z-'; level: number; rope: Rope }[] = [];
  crowd!: THREE.InstancedMesh;
  crowdHeads!: THREE.InstancedMesh;
  crowdData: { x: number; y: number; z: number; ry: number; phase: number; amp: number }[] = [];
  flashes: THREE.Sprite[] = [];
  screenCtx!: CanvasRenderingContext2D;
  screenTex!: THREE.CanvasTexture;
  excitement = 0.3;
  spot!: THREE.SpotLight;

  constructor(scene: THREE.Scene, public matchTitle: string) {
    scene.add(this.group);
    this.buildLights(scene);
    this.buildFloor();
    this.buildRing();
    this.buildBarricades();
    this.buildCrowd();
    this.buildStage();
  }

  private buildLights(scene: THREE.Scene) {
    scene.add(new THREE.HemisphereLight('#8090b0', '#201818', 0.55));
    scene.add(new THREE.AmbientLight('#ffffff', 0.12));
    const spot = new THREE.SpotLight('#fff6e8', 620, 40, Math.PI / 4.2, 0.5, 1.6);
    spot.position.set(0, 16, 2);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 6;
    spot.shadow.camera.far = 30;
    spot.shadow.bias = -0.0004;
    scene.add(spot, spot.target);
    this.spot = spot;
    const fill = new THREE.DirectionalLight('#9fb6ff', 0.55);
    fill.position.set(-8, 10, 12);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffd0a0', 0.35);
    rim.position.set(10, 8, -10);
    scene.add(rim);
  }

  private buildFloor() {
    const floorTex = canvasTex(512, 512, (g) => {
      g.fillStyle = '#1b1c22';
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2500; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(10, 10);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);
    // padded mats around the ring
    const matTex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#16233f';
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = '#0d1528';
      g.lineWidth = 6;
      g.strokeRect(0, 0, 256, 256);
    });
    matTex.wrapS = matTex.wrapT = THREE.RepeatWrapping;
    const s = (RING.floor + 0.5) * 2;
    matTex.repeat.set(s / 2, s / 2);
    const mats = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.9 }));
    mats.rotation.x = -Math.PI / 2;
    mats.position.y = 0.01;
    mats.receiveShadow = true;
    this.group.add(mats);
  }

  private buildRing() {
    const A = RING.apron;
    const H = RING.H;
    // ring block with apron skirt
    const skirt = canvasTex(1024, 128, (g) => {
      g.fillStyle = '#0b0b10';
      g.fillRect(0, 0, 1024, 128);
      g.fillStyle = '#c4122b';
      g.fillRect(0, 0, 1024, 10);
      g.font = 'bold 64px Impact, Arial Black, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#f5f5f5';
      g.fillText('SQUARED CIRCLE MAYHEM', 512, 72);
    });
    const skirtMat = new THREE.MeshStandardMaterial({ map: skirt, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: '#0b0b10' });
    const block = new THREE.Mesh(new THREE.BoxGeometry(A * 2, H, A * 2), [skirtMat, skirtMat, dark, dark, skirtMat, skirtMat]);
    block.position.y = H / 2;
    block.receiveShadow = true;
    block.castShadow = true;
    this.group.add(block);
    // canvas mat
    const matTex = canvasTex(1024, 1024, (g) => {
      g.fillStyle = '#c7c2b8';
      g.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 6000; i++) {
        g.fillStyle = `rgba(80,70,60,${Math.random() * 0.05})`;
        g.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3);
      }
      g.strokeStyle = 'rgba(120,20,30,0.35)';
      g.lineWidth = 18;
      g.beginPath();
      g.arc(512, 512, 200, 0, Math.PI * 2);
      g.stroke();
      g.font = 'bold 120px Impact, Arial Black, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(150,20,35,0.45)';
      g.fillText('SCM', 512, 520);
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 10;
      g.strokeRect(40, 40, 944, 944);
    });
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(A * 2, A * 2), new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.85 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = H + 0.005;
    mat.receiveShadow = true;
    this.group.add(mat);

    // posts and turnbuckles
    const postMat = new THREE.MeshStandardMaterial({ color: '#c8c8cc', metalness: 0.8, roughness: 0.3 });
    const padMats = [new THREE.MeshStandardMaterial({ color: '#c4122b' }), new THREE.MeshStandardMaterial({ color: '#1e48c8' })];
    const P = RING.post;
    const corners: [number, number][] = [
      [P, P],
      [-P, P],
      [-P, -P],
      [P, -P],
    ];
    corners.forEach(([x, z], i) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, H + 1.45, 10), postMat);
      post.position.set(x, (H + 1.45) / 2, z);
      post.castShadow = true;
      this.group.add(post);
      for (const rh of RING.ropeHeights) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.2), i % 2 === 0 ? padMats[0] : padMats[1]);
        pad.position.set(x * 0.985, H + rh, z * 0.985);
        pad.rotation.y = Math.PI / 4;
        pad.castShadow = true;
        this.group.add(pad);
      }
    });
    // ropes
    const ropeMats = [
      new THREE.MeshStandardMaterial({ color: '#d42020', roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: '#2040d0', roughness: 0.5 }),
    ];
    const sides: { side: 'x+' | 'x-' | 'z+' | 'z-'; a: [number, number]; b: [number, number] }[] = [
      { side: 'x+', a: [P, -P], b: [P, P] },
      { side: 'x-', a: [-P, -P], b: [-P, P] },
      { side: 'z+', a: [-P, P], b: [P, P] },
      { side: 'z-', a: [-P, -P], b: [P, -P] },
    ];
    for (const s of sides) {
      RING.ropeHeights.forEach((rh, level) => {
        const a = new THREE.Vector3(s.a[0], H + rh, s.a[1]);
        const b = new THREE.Vector3(s.b[0], H + rh, s.b[1]);
        this.ropes.push({ side: s.side, level, rope: new Rope(a, b, ropeMats[level], this.group) });
      });
    }
    // steel steps in two corners
    const stepMat = new THREE.MeshStandardMaterial({ color: '#6b6e75', metalness: 0.6, roughness: 0.45 });
    for (const [x, z] of [
      [A + 0.45, A + 0.45],
      [-A - 0.45, -A - 0.45],
    ]) {
      for (let i = 0; i < 3; i++) {
        const h = (H / 3) * (i + 1);
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.75, h, 0.75 - i * 0.2), stepMat);
        st.position.set(x, h / 2, z);
        st.rotation.y = Math.PI / 4;
        st.castShadow = st.receiveShadow = true;
        this.group.add(st);
      }
    }
    // lighting truss above
    const truss = new THREE.Group();
    const trussMat = new THREE.MeshStandardMaterial({ color: '#2a2a30', metalness: 0.7, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const bx = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 0.3), trussMat);
      bx.position.set(0, 12, s * 4.5);
      const bz = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 9), trussMat);
      bz.position.set(s * 4.5, 12, 0);
      truss.add(bx, bz);
      for (let i = -3; i <= 3; i += 2) {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.4, 8), new THREE.MeshBasicMaterial({ color: '#fff7dd' }));
        lamp.position.set(i * 1.2, 11.7, s * 4.5);
        truss.add(lamp);
      }
    }
    this.group.add(truss);
  }

  private buildBarricades() {
    const F = RING.floor + 0.5;
    const mat = new THREE.MeshStandardMaterial({ color: '#15151a', roughness: 0.6, metalness: 0.4 });
    const padTex = canvasTex(1024, 64, (g) => {
      g.fillStyle = '#c4122b';
      g.fillRect(0, 0, 1024, 64);
      g.font = 'bold 38px Impact, Arial Black, sans-serif';
      g.fillStyle = '#fff';
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      g.fillText('SQUARED CIRCLE MAYHEM', 300, 34);
      g.fillStyle = '#f5c518';
      g.fillText('★ ★ ★', 800, 34);
    });
    padTex.wrapS = THREE.RepeatWrapping;
    padTex.repeat.set(2, 1);
    const pad = new THREE.MeshStandardMaterial({ map: padTex });
    const mk = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), [mat, mat, pad, mat, pad, pad]);
      m.position.set(x, 0.55, z);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
    };
    mk(F * 2, 0.15, 0, F);
    mk(0.15, F * 2, F, 0);
    mk(0.15, F * 2, -F, 0);
    // back side has a gap for the entrance ramp
    mk(F - 1.6, 0.15, -(F + 1.6) / 2, -F);
    mk(F - 1.6, 0.15, (F + 1.6) / 2, -F);
  }

  private buildCrowd() {
    const F = RING.floor + 0.5;
    const rows = 7;
    const positions: { x: number; y: number; z: number; ry: number }[] = [];
    const stands = new THREE.MeshStandardMaterial({ color: '#1b1b22', roughness: 0.9 });
    // +Z side, +X side, -X side face the ring
    const defs = [
      { cx: 0, cz: 1, ax: 1, az: 0, len: 2 * F + 6 },
      { cx: 1, cz: 0, ax: 0, az: 1, len: 2 * F + 2 },
      { cx: -1, cz: 0, ax: 0, az: 1, len: 2 * F + 2 },
    ];
    for (const d of defs) {
      for (let r = 0; r < rows; r++) {
        const off = F + 1.6 + r * 0.9;
        const y = 0.3 + r * 0.55;
        const step = new THREE.Mesh(new THREE.BoxGeometry(d.ax ? d.len : 0.9, y, d.az ? d.len : 0.9), stands);
        step.position.set(d.cx * off, y / 2, d.cz * off);
        step.receiveShadow = true;
        this.group.add(step);
        const n = Math.floor(d.len / 0.62);
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.1) continue;
          const t = (i / n - 0.5) * d.len + (Math.random() - 0.5) * 0.15;
          positions.push({
            x: d.cx * off + d.ax * t,
            y,
            z: d.cz * off + d.az * t,
            ry: Math.atan2(-d.cx, -d.cz),
          });
        }
      }
    }
    const bodyGeo = new THREE.BoxGeometry(0.42, 0.62, 0.28);
    bodyGeo.translate(0, 0.31, 0);
    const headGeo = new THREE.SphereGeometry(0.13, 6, 5);
    headGeo.translate(0, 0.78, 0);
    const bodyMat = new THREE.MeshLambertMaterial();
    const headMat = new THREE.MeshLambertMaterial();
    this.crowd = new THREE.InstancedMesh(bodyGeo, bodyMat, positions.length);
    this.crowdHeads = new THREE.InstancedMesh(headGeo, headMat, positions.length);
    const shirt = ['#c4122b', '#1e48c8', '#e8e8e8', '#222', '#f5c518', '#3fa34d', '#7b3fe4', '#e0479e', '#18b8b0', '#444', '#8a5a2b'];
    const skins = ['#f1c7a5', '#e0a77f', '#c48a5f', '#8d5a3b', '#5c3a24', '#f6d9c4'];
    const c = new THREE.Color();
    positions.forEach((p, i) => {
      this.crowdData.push({ ...p, phase: Math.random() * Math.PI * 2, amp: 0.5 + Math.random() });
      this.crowd.setColorAt(i, c.set(shirt[Math.floor(Math.random() * shirt.length)]));
      this.crowdHeads.setColorAt(i, c.set(skins[Math.floor(Math.random() * skins.length)]));
    });
    this.group.add(this.crowd, this.crowdHeads);
    this.updateCrowd(0);
    // camera flash sprites
    const flashMat = new THREE.SpriteMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(flashMat.clone());
      s.scale.set(0.5, 0.5, 1);
      this.group.add(s);
      this.flashes.push(s);
    }
  }

  private buildStage() {
    const F = RING.floor + 0.5;
    // ramp
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#111118', roughness: 0.6 }));
    ramp.position.set(0, 0.25, -F - 4);
    ramp.receiveShadow = true;
    this.group.add(ramp);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 5), new THREE.MeshStandardMaterial({ color: '#0d0d12' }));
    stage.position.set(0, 0.6, -F - 10);
    this.group.add(stage);
    // big screen
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    this.screenCtx = c.getContext('2d')!;
    this.screenTex = new THREE.CanvasTexture(c);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({ map: this.screenTex }));
    screen.position.set(0, 5.6, -F - 11.5);
    this.group.add(screen);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(12.6, 6.6, 0.3), new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.6 }));
    frame.position.set(0, 5.6, -F - 11.7);
    this.group.add(frame);
    // stage light bars
    for (let i = -3; i <= 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), new THREE.MeshBasicMaterial({ color: i % 2 ? '#c4122b' : '#1e48c8' }));
      bar.position.set(i * 2.6, 3, -F - 12.5);
      this.group.add(bar);
    }
    this.setScreen(this.matchTitle, 'TONIGHT');
  }

  setScreen(big: string, small: string, colour = '#c4122b') {
    const g = this.screenCtx;
    const grd = g.createLinearGradient(0, 0, 1024, 512);
    grd.addColorStop(0, '#08080d');
    grd.addColorStop(1, colour);
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 512; i += 6) g.fillRect(0, i, 1024, 2);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.font = 'bold 54px Impact, Arial Black, sans-serif';
    g.fillText(small, 512, 150);
    let size = 120;
    g.font = `bold ${size}px Impact, Arial Black, sans-serif`;
    while (g.measureText(big).width > 960 && size > 40) {
      size -= 6;
      g.font = `bold ${size}px Impact, Arial Black, sans-serif`;
    }
    g.fillText(big, 512, 300);
    this.screenTex.needsUpdate = true;
  }

  /** Push the rope on a side at world position p, by amount (metres outward). */
  pushRope(x: number, z: number, amount: number, levels = [0, 1, 2]) {
    const P = RING.post;
    let side: 'x+' | 'x-' | 'z+' | 'z-';
    if (Math.abs(x) > Math.abs(z)) side = x > 0 ? 'x+' : 'x-';
    else side = z > 0 ? 'z+' : 'z-';
    const along = side[0] === 'x' ? z : x;
    const s = (along + P) / (2 * P);
    for (const r of this.ropes) {
      if (r.side !== side || !levels.includes(r.level)) continue;
      r.rope.s = Math.min(0.95, Math.max(0.05, s));
      const n = side === 'x+' ? [1, 0] : side === 'x-' ? [-1, 0] : side === 'z+' ? [0, 1] : [0, -1];
      r.rope.vel.x += n[0] * amount * 14;
      r.rope.vel.z += n[1] * amount * 14;
    }
  }

  private crowdT = 0;
  private dummy = new THREE.Object3D();
  updateCrowd(dt: number) {
    this.crowdT += dt;
    this.excitement += (0.3 - this.excitement) * Math.min(1, dt * 0.25);
    const ex = this.excitement;
    const d = this.dummy;
    for (let i = 0; i < this.crowdData.length; i++) {
      const c = this.crowdData[i];
      const bounce = Math.max(0, Math.sin(this.crowdT * (5 + c.amp * 2) + c.phase)) * 0.22 * ex * c.amp;
      d.position.set(c.x, c.y + bounce, c.z);
      d.rotation.set(0, c.ry, Math.sin(this.crowdT * 2 + c.phase) * 0.05 * ex);
      d.updateMatrix();
      this.crowd.setMatrixAt(i, d.matrix);
      this.crowdHeads.setMatrixAt(i, d.matrix);
    }
    this.crowd.instanceMatrix.needsUpdate = true;
    this.crowdHeads.instanceMatrix.needsUpdate = true;
    for (const f of this.flashes) {
      const m = f.material as THREE.SpriteMaterial;
      m.opacity = Math.max(0, m.opacity - dt * 8);
      if (m.opacity <= 0 && Math.random() < dt * (0.4 + ex * 3)) {
        const c = this.crowdData[Math.floor(Math.random() * this.crowdData.length)];
        f.position.set(c.x, c.y + 1.0, c.z);
        m.opacity = 1;
      }
    }
  }

  update(dt: number) {
    for (const r of this.ropes) r.rope.update(dt);
    this.updateCrowd(dt);
  }
}
