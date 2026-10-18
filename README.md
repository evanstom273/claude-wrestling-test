# Squared Circle Mayhem

An MDickie-style 3D wrestling game that runs in the browser. Low-poly lads and lasses, a proper ring with bouncy ropes, a referee who actually counts, and a steel chair or two at ringside.

**Play it:** https://evanstom273.github.io/claude-wrestling-test/

Built with React, Vite, TypeScript, Tailwind CSS and Three.js. No art or audio assets: every wrestler is built from primitives, every animation is keyframed in code, and every sound is synthesised with WebAudio.

## What's in it

- **8 wrestlers** with their own looks, stats, movesets and finishers
- **Singles, Triple Threat and Fatal 4-Way** matches, any mix of humans and CPUs
- **Strikes and combos**: jabs, haymakers, forearms, big boots, stomps, running clotheslines, shoulder blocks and dropkicks
- **Grapples**: body slams, vertical and German suplexes, DDTs, piledrivers, powerbombs, chokeslams, spinebusters, neckbreakers, stunners, hip tosses and more
- **Lock-up reversals**, escaping holds, Irish whips into the ropes and turnbuckles, counters on running opponents
- **Pinfalls** with a referee who has to get there first, kick-outs, rope breaks and **submissions**
- **Momentum**: fill the bar and hit your finisher
- **Leave the ring**, brawl on the floor, pick up chairs, bin lids and kendo sticks, swing them or throw them
- **Climb the turnbuckles** and fly: crossbodies, splashes, elbow and leg drops. You can be knocked off the top, and over the top rope
- CPU opponents on three difficulties, keyboard, gamepad (two players) and touch controls

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | WASD / Arrow keys | Left stick / D-pad |
| Attack | J or Z | X / □ |
| Grab | K or X | A / ✕ |
| Run (hold) | L, C or Shift | RB / RT |
| Pin · Pick up weapon · Climb corner · Throw weapon | I or V | B / ○ |
| Taunt · Finisher (while grappling, bar full) | U or Space | Y / △ |
| Rotate camera | Q / E | Right stick |
| Pause | Esc / P | Start |

**How to wrestle**

- Grab someone, then press **Attack** or **Grab**, with or without a direction, for four different moves. Grab from behind for suplexes.
- While grappling, **Run** + a direction whips them into the ropes. Grab them as they come back for a counter.
- Grab a downed opponent to pick them up, or Grab + a direction for a submission.
- Pin a downed opponent. When you're pinned or trapped, **mash buttons**.
- Push against the ropes to leave the ring and against the apron to get back in.

## Development

```bash
npm install
npm run dev      # http://localhost:5173/claude-wrestling-test/
npm run build    # type-check and build to dist/
```

Handy URL flags for testing: `?demo=2` (2 to 4) drops straight into a CPU match, `&human=1` makes slot one keyboard controlled, `&passive=1` makes the CPUs stand still and `&speed=10` runs the simulation faster.

### Layout

| File | What it does |
| --- | --- |
| `src/game/Game.ts` | Renderer, main loop, camera, collisions, HUD bridge |
| `src/game/Wrestler.ts` | The wrestler state machine: movement, strikes, grabs, pins, climbing, weapons |
| `src/game/Link.ts` | Two-person interactions: holds, moves, pins and submissions |
| `src/game/moves.ts` | Keyframed grapple moves for attacker and victim |
| `src/game/poses.ts`, `pose.ts` | Pose library and pose maths |
| `src/game/Rig.ts` | The low-poly character model |
| `src/game/AI.ts` | CPU behaviour |
| `src/game/Referee.ts` | The ref |
| `src/game/Arena.ts` | Ring, ropes, crowd, lights, big screen |
| `src/ui/` | Menus, HUD and touch controls |

## Deployment

`.github/workflows/deploy.yml` builds the site and deploys it to GitHub Pages on every push to `main`. The repository's Pages source needs to be set to **GitHub Actions** (Settings → Pages → Build and deployment).
