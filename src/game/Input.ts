export type ControlType = 'keyboard' | 'pad1' | 'pad2' | 'cpu';

export interface Intent {
  mx: number; // screen-relative move: +x right
  my: number; // +y up (away from camera)
  attack: boolean; // pressed this frame
  grab: boolean;
  pick: boolean;
  taunt: boolean;
  run: boolean; // held
  mash: boolean; // any action pressed this frame
}

export const emptyIntent = (): Intent => ({ mx: 0, my: 0, attack: false, grab: false, pick: false, taunt: false, run: false, mash: false });

const KEYMAP: Record<string, keyof Intent | 'up' | 'down' | 'left' | 'right' | 'camL' | 'camR'> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  KeyZ: 'attack',
  KeyJ: 'attack',
  KeyX: 'grab',
  KeyK: 'grab',
  KeyC: 'run',
  KeyL: 'run',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyV: 'pick',
  KeyI: 'pick',
  Space: 'taunt',
  KeyU: 'taunt',
  KeyQ: 'camL',
  KeyE: 'camR',
};

class InputManager {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private padPrev: boolean[][] = [[], []];
  camAxis = 0;
  touchMove = { x: 0, y: 0 };
  touchRun = false;
  onPause: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      if (k) e.preventDefault();
      if (e.code === 'Escape' || e.code === 'KeyP') this.onPause?.();
      if (!e.repeat && k) this.pressed.add(k);
      if (k) this.down.add(k);
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) this.down.delete(k);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  /** On-screen touch buttons feed the keyboard player. */
  touchPress(action: 'attack' | 'grab' | 'pick' | 'taunt') {
    this.pressed.add(action);
  }

  /** Called once per frame before reading intents. */
  poll() {
    this.camAxis = (this.down.has('camR') ? 1 : 0) - (this.down.has('camL') ? 1 : 0);
  }

  /** Called once per frame after all intents are read. */
  endFrame() {
    this.pressed.clear();
  }

  read(type: ControlType, out: Intent) {
    out.mx = out.my = 0;
    out.attack = out.grab = out.pick = out.taunt = out.run = out.mash = false;
    if (type === 'keyboard') {
      const d = this.down;
      const p = this.pressed;
      out.mx = (d.has('right') ? 1 : 0) - (d.has('left') ? 1 : 0);
      out.my = (d.has('up') ? 1 : 0) - (d.has('down') ? 1 : 0);
      out.attack = p.has('attack');
      out.grab = p.has('grab');
      out.pick = p.has('pick');
      out.taunt = p.has('taunt');
      out.run = d.has('run') || this.touchRun;
      if (this.touchMove.x || this.touchMove.y) {
        out.mx = this.touchMove.x;
        out.my = this.touchMove.y;
      }
    } else if (type === 'pad1' || type === 'pad2') {
      const idx = type === 'pad1' ? 0 : 1;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const connected = [...pads].filter((p): p is Gamepad => !!p);
      const pad = connected[idx];
      if (pad) {
        const b = pad.buttons.map((x) => x.pressed);
        const prev = this.padPrev[idx];
        const edge = (i: number) => !!b[i] && !prev[i];
        let ax = pad.axes[0] ?? 0;
        let ay = -(pad.axes[1] ?? 0);
        if (Math.abs(ax) < 0.2) ax = 0;
        if (Math.abs(ay) < 0.2) ay = 0;
        if (b[12]) ay = 1;
        if (b[13]) ay = -1;
        if (b[14]) ax = -1;
        if (b[15]) ax = 1;
        out.mx = ax;
        out.my = ay;
        out.attack = edge(2);
        out.grab = edge(0);
        out.pick = edge(1);
        out.taunt = edge(3);
        out.run = !!(b[5] || b[7] || b[4] || b[6]);
        if (edge(9)) this.onPause?.();
        const rx = pad.axes[2] ?? 0;
        if (Math.abs(rx) > 0.3) this.camAxis = rx;
        this.padPrev[idx] = b;
      }
    }
    const len = Math.hypot(out.mx, out.my);
    if (len > 1) {
      out.mx /= len;
      out.my /= len;
    }
    out.mash = out.attack || out.grab || out.pick || out.taunt;
    return out;
  }
}

export const input = new InputManager();
