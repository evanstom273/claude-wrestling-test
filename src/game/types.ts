import type * as THREE from 'three';
import type { Arena } from './Arena';
import type { Wrestler } from './Wrestler';
import type { Referee } from './Referee';
import type { Weapon } from './Weapon';
import type { Link } from './Link';

export interface World {
  wrestlers: Wrestler[];
  ref: Referee;
  arena: Arena;
  weapons: Weapon[];
  links: Link[];
  scene: THREE.Scene;
  time: number;
  over: boolean;
  difficulty: number; // 0 easy .. 1 hard
  say(text: string, colour?: string): void;
  banner(text: string, sub?: string, dur?: number): void;
  shake(amount: number): void;
  hitstop(t: number): void;
  sparks(pos: THREE.Vector3, n?: number, colour?: string): void;
  excite(amount: number): void;
  win(winner: Wrestler, loser: Wrestler, method: string): void;
}
