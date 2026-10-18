import * as THREE from 'three';
import { Rig } from '../game/Rig';
import { ROSTER } from '../game/roster';
import * as K from '../game/poses';

let cache: Record<string, string> | null = null;

/** Render a head-and-shoulders portrait of each wrestler from their actual rig. */
export function getPortraits(): Record<string, string> {
  if (cache) return cache;
  cache = {};
  try {
    const size = 256;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(1);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#303040', 1.4));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#88aaff', 1.2);
    rim.position.set(-3, 2, -2);
    scene.add(rim);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    for (const w of ROSTER) {
      const rig = new Rig(w.look);
      rig.pose.set(w.style === 'powerhouse' || w.style === 'hardcore' ? K.TAUNT_FLEX : K.STANCE);
      rig.apply();
      rig.root.rotation.y = -0.35;
      scene.add(rig.root);
      rig.root.updateMatrixWorld(true);
      const head = rig.head.getWorldPosition(new THREE.Vector3());
      cam.position.set(head.x + 0.45, head.y + 0.12, head.z + 2.05);
      cam.lookAt(head.x, head.y - 0.2, head.z);
      renderer.render(scene, cam);
      cache[w.id] = renderer.domElement.toDataURL('image/png');
      scene.remove(rig.root);
    }
    renderer.dispose();
    renderer.forceContextLoss();
  } catch {
    // WebGL unavailable: cards fall back to initials
  }
  return cache;
}
