// Tiny external store bridging the imperative game loop and the React HUD.

export interface HudWrestler {
  id: number;
  name: string;
  nick: string;
  colour: string;
  hp: number;
  spirit: number;
  human: boolean;
  player: number; // -1 for CPU
  state: string;
}

export interface HudLine {
  id: number;
  text: string;
  colour?: string;
  t: number;
}

export interface HudState {
  wrestlers: HudWrestler[];
  time: number;
  banner: { id: number; text: string; sub: string; until: number } | null;
  lines: HudLine[];
  mash: { label: string; value: number; danger: number; player: number } | null;
  result: { winner: string; colour: string; method: string; time: number; loser: string } | null;
  paused: boolean;
  now: number;
}

let state: HudState = {
  wrestlers: [],
  time: 0,
  banner: null,
  lines: [],
  mash: null,
  result: null,
  paused: false,
  now: 0,
};
const listeners = new Set<() => void>();

export const hud = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set(patch: Partial<HudState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  reset() {
    state = { wrestlers: [], time: 0, banner: null, lines: [], mash: null, result: null, paused: false, now: 0 };
    listeners.forEach((l) => l());
  },
};
