import * as THREE from 'three';
import { Arena } from './Arena';
import { Wrestler } from './Wrestler';
import { Referee } from './Referee';
import { Weapon, type WeaponKind } from './Weapon';
import { type Link, updateLinks, breakLink } from './Link';
import { AI } from './AI';
import { ROSTER } from './roster';
import { input, emptyIntent, type ControlType, type Intent } from './Input';
import { audio } from './Audio';
import { hud, type HudLine } from './hud';
import type { World } from './types';
import { RING, clamp, lerp } from './constants';

export interface Slot {
  wrestlerId: string;
  control: ControlType;
}

export interface MatchConfig {
  slots: Slot[];
  difficulty: 'easy' | 'normal' | 'hard';
  weapons: boolean;
}

const MATCH_NAMES: Record<number, string> = { 2: 'SINGLES MATCH', 3: 'TRIPLE THREAT', 4: 'FATAL FOUR WAY' };

interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

export class Game implements World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  arena: Arena;
  wrestlers: Wrestler[] = [];
  ref: Referee;
  weapons: Weapon[] = [];
  links: Link[] = [];
  time = 0;
  over = false;
  difficulty: number;
  paused = false;

  private raf = 0;
  private last = 0;
  private intents = new Map<Wrestler, Intent>();
  private camAz = 0;
  private camTarget = new THREE.Vector3(0, 1.4, 0);
  private camDist = 11;
  private shakeAmt = 0;
  private hitstopT = 0;
  private slowmo = 0;
  private sparkList: Spark[] = [];
  private sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  private lines: HudLine[] = [];
  private lineId = 0;
  private bannerState: { id: number; text: string; sub: string; until: number } | null = null;
  private hudT = 0;
  private resultAt = -1;
  private resultData: { winner: string; colour: string; method: string; time: number; loser: string } | null = null;
  private onResize = () => this.resize();
  private matchTitle: string;

  constructor(
    private container: HTMLElement,
    public config: MatchConfig,
  ) {
    this.difficulty = config.difficulty === 'easy' ? 0.15 : config.difficulty === 'normal' ? 0.5 : 0.9;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.scene.background = new THREE.Color('#05050a');
    this.scene.fog = new THREE.Fog('#05050a', 22, 48);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);

    this.matchTitle = MATCH_NAMES[config.slots.length] ?? 'MATCH';
    this.arena = new Arena(this.scene, this.matchTitle);

    // wrestlers
    const starts: [number, number][] = [
      [-1.9, 1.9],
      [1.9, -1.9],
      [1.9, 1.9],
      [-1.9, -1.9],
    ];
    let humanIdx = 0;
    config.slots.forEach((slot, i) => {
      const prof = ROSTER.find((r) => r.id === slot.wrestlerId) ?? ROSTER[i];
      const w = new Wrestler(prof, slot.control);
      w.pos.set(starts[i][0], RING.H, starts[i][1]);
      w.faceTowards(0, 0);
      if (slot.control === 'cpu') w.ai = new AI(w, this.difficulty);
      else w.playerIndex = humanIdx++;
      this.scene.add(w.rig.root);
      this.wrestlers.push(w);
      this.intents.set(w, emptyIntent());
    });
    this.ref = new Referee();
    this.ref.pos.set(0, RING.H, -2.3);
    this.scene.add(this.ref.rig.root);

    if (config.weapons) {
      const spots: [WeaponKind, number, number][] = [
        ['chair', RING.apron + 1.6, 2.5],
        ['chair', -(RING.apron + 1.8), -1.5],
        ['bin', 1.5, RING.apron + 1.7],
        ['kendo', -2.5, -(RING.apron + 1.5)],
      ];
      for (const [k, x, z] of spots) this.weapons.push(new Weapon(k, this.scene, x, z));
    }

    // player marker arrows
    this.wrestlers.forEach((w) => {
      if (w.playerIndex < 0) return;
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.18, 4),
        new THREE.MeshBasicMaterial({ color: w.playerIndex === 0 ? '#ff3b3b' : '#3b8bff' }),
      );
      m.rotation.x = Math.PI;
      m.name = 'marker';
      this.scene.add(m);
      markers.set(w, m);
    });

    input.onPause = () => this.togglePause();
    window.addEventListener('resize', this.onResize);
    this.resize();
    hud.reset();
    audio.startCrowd();
    audio.bell(3);
    this.banner(this.matchTitle, 'FIGHT!', 2);
    this.say('The bell rings and we are underway!');
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------------ World API
  say(text: string, colour?: string) {
    this.lines.push({ id: this.lineId++, text, colour, t: this.time });
    if (this.lines.length > 5) this.lines.shift();
  }
  banner(text: string, sub = '', dur = 1.5) {
    this.bannerState = { id: this.lineId++, text, sub, until: this.time + dur };
    this.pushHud();
  }
  shake(a: number) {
    this.shakeAmt = Math.max(this.shakeAmt, a);
  }
  hitstop(t: number) {
    this.hitstopT = Math.max(this.hitstopT, t);
  }
  excite(a: number) {
    this.arena.excitement = Math.min(1.5, this.arena.excitement + a * 0.5);
  }
  sparks(pos: THREE.Vector3, n = 6, colour = '#ffffff') {
    const mat = new THREE.MeshBasicMaterial({ color: colour, transparent: true });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.sparkGeo, mat);
      m.position.copy(pos);
      this.scene.add(m);
      this.sparkList.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5),
        life: 0.35 + Math.random() * 0.25,
      });
    }
  }
  win(winner: Wrestler, loser: Wrestler, method: string) {
    if (this.over) return;
    this.over = true;
    for (const L of [...this.links]) breakLink(this, L, 'end');
    audio.bell(3);
    audio.pop(1.6);
    this.excite(2);
    this.slowmo = 1.2;
    const how = method === 'pinfall' ? 'by pinfall' : 'by submission';
    this.banner(`${winner.name.toUpperCase()} WINS!`, how.toUpperCase(), 4);
    this.say(`${winner.name} defeats ${loser.name} ${how}!`, winner.profile.colour);
    this.arena.setScreen(winner.name.toUpperCase(), 'YOUR WINNER', winner.profile.colour);
    this.ref.winner = winner;
    this.resultData = { winner: winner.name, colour: winner.profile.colour, method: how, time: this.time, loser: loser.name };
    this.resultAt = this.time + 3.5;
    setTimeout(() => {
      if (winner.state !== 'link') winner.setState('celebrate');
    }, 1300);
  }

  togglePause() {
    if (this.resultData && this.time > this.resultAt) return;
    this.paused = !this.paused;
    hud.set({ paused: this.paused });
  }

  // ------------------------------------------------------------------ loop
  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.paused) {
      input.poll();
      input.endFrame();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.hitstopT > 0) {
      this.hitstopT -= dt;
      dt *= 0.08;
    } else if (this.slowmo > 0) {
      this.slowmo -= dt;
      dt *= 0.35;
    }
    for (let i = 0; i < SIM_SPEED; i++) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private update(dt: number) {
    this.time += dt;
    input.poll();
    this.camAz += input.camAxis * dt * 1.6;

    // intents
    const R = new THREE.Vector3(Math.cos(this.camAz), 0, -Math.sin(this.camAz));
    const F = new THREE.Vector3(-Math.sin(this.camAz), 0, -Math.cos(this.camAz));
    for (const w of this.wrestlers) {
      const it = this.intents.get(w)!;
      if (w.ai) w.ai.update(dt, this, it);
      else {
        input.read(w.ctl, it);
        if (this.over) {
          it.attack = it.grab = it.pick = it.run = false;
          it.taunt = false;
        }
        const sx = it.mx;
        const sy = it.my;
        it.mx = R.x * sx + F.x * sy;
        it.my = R.z * sx + F.z * sy;
      }
    }
    for (const w of this.wrestlers) w.update(dt, this.intents.get(w)!, this);
    updateLinks(this, dt);
    this.collide();
    this.updateWeapons(dt);
    for (const w of this.wrestlers) w.applyRig(dt);
    this.ref.update(dt, this);
    this.arena.update(dt);
    audio.setCrowd(Math.min(1, this.arena.excitement * 0.75));
    this.updateSparks(dt);
    this.updateMarkers();
    this.updateCamera(dt);
    input.endFrame();

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.066;
      this.pushHud();
    }
  }

  private collide() {
    const ws = this.wrestlers;
    for (let i = 0; i < ws.length; i++) {
      const a = ws[i];
      if (!solid(a)) continue;
      for (let j = i + 1; j < ws.length; j++) {
        const b = ws[j];
        if (!solid(b) || a.inRing !== b.inRing) continue;
        if (a.link && a.link === b.link) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = 0.6;
        if (d < min && d > 1e-4) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          const aw = a.link ? 0 : 1;
          const bw = b.link ? 0 : 1;
          const tot = aw + bw || 1;
          a.pos.x -= nx * push * 2 * (aw / tot);
          a.pos.z -= nz * push * 2 * (aw / tot);
          b.pos.x += nx * push * 2 * (bw / tot);
          b.pos.z += nz * push * 2 * (bw / tot);
          if (!a.link) a.clampBounds();
          if (!b.link) b.clampBounds();
        }
      }
    }
  }

  private updateWeapons(dt: number) {
    for (const wpn of this.weapons) {
      wpn.update(dt);
      if (!wpn.flying || !wpn.thrower) continue;
      for (const w of this.wrestlers) {
        if (w === wpn.thrower || w.eliminated) continue;
        const lv = w.level();
        if (lv !== 'stand') continue;
        const dy = wpn.pos.y - (w.pos.y + 1.2);
        if (Math.abs(dy) > 0.8) continue;
        if (Math.hypot(wpn.pos.x - w.pos.x, wpn.pos.z - w.pos.z) < 0.55) {
          w.hurt(wpn.dmg * 0.9, wpn.thrower, this);
          audio.clang();
          this.sparks(wpn.pos, 10, '#fff2a8');
          this.shake(0.2);
          this.say(`${wpn.thrower.name} launches the ${wpn.name} into ${w.name}!`, wpn.thrower.profile.colour);
          this.excite(0.6);
          w.knockDown(wpn.thrower, this, false, 2);
          wpn.vel.multiplyScalar(-0.25);
          wpn.thrower = null;
          break;
        }
      }
    }
  }

  private updateSparks(dt: number) {
    for (let i = this.sparkList.length - 1; i >= 0; i--) {
      const s = this.sparkList[i];
      s.life -= dt;
      s.vel.y -= 12 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life * 2.5);
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.sparkList.splice(i, 1);
      }
    }
  }

  private updateMarkers() {
    for (const [w, m] of markers) {
      w.rig.worldHead(m.position);
      m.position.y += 0.42 + Math.sin(this.time * 6) * 0.04;
      m.rotation.y += 0.05;
      m.visible = !this.over;
    }
  }

  private updateCamera(dt: number) {
    const active = this.wrestlers.filter((w) => !w.eliminated);
    const c = new THREE.Vector3();
    let wsum = 0;
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const w of active) {
      const k = w.human ? 1.6 : 1;
      c.addScaledVector(w.pos, k);
      wsum += k;
      minX = Math.min(minX, w.pos.x);
      maxX = Math.max(maxX, w.pos.x);
      minZ = Math.min(minZ, w.pos.z);
      maxZ = Math.max(maxZ, w.pos.z);
    }
    c.multiplyScalar(1 / Math.max(1, wsum));
    // keep the ring partly in frame
    c.x *= 0.85;
    c.z *= 0.85;
    c.y = clamp(c.y, 0, RING.H) + 1.1;
    const spread = Math.max(maxX - minX, (maxZ - minZ) * 1.3);
    const wantDist = clamp(7.5 + spread * 0.95, 8.5, 17);
    const k = 1 - Math.exp(-dt * 3);
    this.camTarget.lerp(c, k);
    this.camDist = lerp(this.camDist, wantDist, 1 - Math.exp(-dt * 1.5));
    const el = 0.5;
    const d = this.camDist;
    this.camera.position.set(
      this.camTarget.x + Math.sin(this.camAz) * d * Math.cos(el),
      this.camTarget.y + d * Math.sin(el),
      this.camTarget.z + Math.cos(this.camAz) * d * Math.cos(el),
    );
    if (this.shakeAmt > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-dt * 10);
    }
    this.camera.lookAt(this.camTarget);
  }

  private pushHud() {
    const now = this.time;
    this.lines = this.lines.filter((l) => now - l.t < 5);
    if (this.bannerState && now > this.bannerState.until) this.bannerState = null;
    let mash: { label: string; value: number; danger: number; player: number } | null = null;
    for (const L of this.links) {
      if (!L.vic.human) continue;
      if (L.kind === 'pin') mash = { label: 'KICK OUT! MASH BUTTONS', value: L.escape, danger: (L.count + L.countT / 0.78) / 3, player: L.vic.playerIndex };
      else if (L.kind === 'sub') mash = { label: 'ESCAPE! MASH BUTTONS', value: L.escape, danger: L.tap, player: L.vic.playerIndex };
      else if (L.kind === 'hold' && L.t > 0.3) mash = { label: 'STRUGGLE!', value: L.escape, danger: 0, player: L.vic.playerIndex };
    }
    hud.set({
      wrestlers: this.wrestlers.map((w) => ({
        id: w.id,
        name: w.name,
        nick: w.profile.nick,
        colour: w.profile.colour,
        hp: w.hp,
        spirit: w.spirit,
        human: w.human,
        player: w.playerIndex,
        state: w.state,
      })),
      time: this.time,
      lines: [...this.lines],
      banner: this.bannerState,
      mash,
      result: this.resultData && now > this.resultAt ? this.resultData : null,
      paused: this.paused,
      now,
    });
  }

  private resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 60 : 42;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    input.onPause = null;
    markers.clear();
    this.renderer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.domElement.remove();
  }
}

// ?speed=N runs N simulation steps per frame (testing aid)
const SIM_SPEED = Math.max(1, Math.min(20, Number(new URLSearchParams(location.search).get('speed')) || 1));

const markers = new Map<Wrestler, THREE.Mesh>();

function solid(w: Wrestler) {
  const s = w.state;
  return s === 'idle' || s === 'run' || s === 'strike' || s === 'hurt' || s === 'taunt' || s === 'holding' || s === 'held' || s === 'whipped' || s === 'whip' || s === 'grabmiss' || s === 'throw' || s === 'pickup' || s === 'celebrate' || s === 'slump';
}
