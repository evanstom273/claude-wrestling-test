import * as THREE from 'three';
import { Rig } from '../src/game/Rig';
import * as Poses from '../src/game/poses';
import { ROSTER } from '../src/game/roster';
import { MOVES, newSample, sampleMove } from '../src/game/moves';

const params = new URLSearchParams(location.search);
const names = (params.get('poses') ?? 'STAND,STANCE,WALK_A,RUN_A').split(',');
const yaw = Number(params.get('yaw') ?? 0.6);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#556');
scene.add(new THREE.HemisphereLight('#fff', '#445', 1.5));
const d = new THREE.DirectionalLight('#fff', 2);
d.position.set(3, 6, 5);
scene.add(d);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshStandardMaterial({ color: '#888' }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const moveId = params.get('move');
const times = (params.get('t') ?? '0,0.5,1,1.5,2').split(',').map(Number);
const cols = moveId ? times.length : names.length;
if (moveId) {
  const m = MOVES[moveId];
  times.forEach((t, i) => {
    const base = new THREE.Vector3((i - (cols - 1) / 2) * 2.6, 0, 0);
    const A = new Rig(ROSTER[Number(params.get('a') ?? 0)].look);
    const Vr = new Rig(ROSTER[Number(params.get('v') ?? 3)].look);
    const s = newSample();
    sampleMove(m.atk, t, s);
    A.pose.set(s.pose); A.apply();
    const ay = yaw;
    const rot = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]).applyAxisAngle(new THREE.Vector3(0,1,0), ay);
    A.root.position.copy(base).add(rot(s.p)); A.root.rotation.y = ay + s.ry;
    sampleMove(m.vic, t, s);
    Vr.pose.set(s.pose); Vr.apply();
    Vr.root.position.copy(base).add(rot(s.p)); Vr.root.rotation.y = ay + s.ry;
    scene.add(A.root, Vr.root);
  });
}
if (!moveId) names.forEach((n, i) => {
  const look = ROSTER[Number(params.get('w') ?? i) % ROSTER.length].look;
  const r = new Rig(look);
  r.pose.set((Poses as any)[n]);
  r.apply();
  r.root.position.set((i - (cols - 1) / 2) * 2.1, 0, 0);
  r.root.rotation.y = yaw;
  scene.add(r.root);
});
const hw = cols * (moveId ? 1.3 : 1.05), hh = hw * innerHeight / innerWidth;
const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 100);
cam.position.set(0, 1.0 + Number(params.get('el') ?? 3), 10);
cam.lookAt(0, 1.0, 0);
renderer.render(scene, cam);
(window as any).done = true;
