import { useEffect, useMemo, useState } from 'react';
import { ROSTER, type Wrestler } from '../game/roster';
import type { MatchConfig, Slot } from '../game/Game';
import type { ControlType } from '../game/Input';
import { getPortraits } from './portraits';
import { audio } from '../game/Audio';
import ControlsCard from './ControlsCard';

const CONTROL_LABEL: Record<ControlType, string> = {
  keyboard: 'P1 · Keyboard',
  pad1: 'Gamepad 1',
  pad2: 'Gamepad 2',
  cpu: 'CPU',
};
const CONTROL_ORDER: ControlType[] = ['keyboard', 'pad1', 'pad2', 'cpu'];

const TYPES = [
  { n: 2, name: 'Singles', sub: 'One on one' },
  { n: 3, name: 'Triple Threat', sub: 'First fall wins' },
  { n: 4, name: 'Fatal 4-Way', sub: 'Absolute chaos' },
];

function defaultSlots(n: number, prev?: Slot[]): Slot[] {
  const used = new Set<string>();
  const out: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const p = prev?.[i];
    let id = p?.wrestlerId;
    if (!id || used.has(id)) id = ROSTER.find((r) => !used.has(r.id))!.id;
    used.add(id);
    out.push({ wrestlerId: id, control: p?.control ?? (i === 0 ? 'keyboard' : 'cpu') });
  }
  return out;
}

function StatBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-400">
      <span className="w-9">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded bg-zinc-800">
        <div className="h-full rounded bg-gradient-to-r from-yellow-500 to-red-500" style={{ width: `${v * 10}%` }} />
      </div>
    </div>
  );
}

export default function Setup({ initial, onStart, onBack }: { initial: MatchConfig | null; onStart: (c: MatchConfig) => void; onBack: () => void }) {
  const portraits = useMemo(() => getPortraits(), []);
  const [slots, setSlots] = useState<Slot[]>(() => initial?.slots ?? defaultSlots(2));
  const [active, setActive] = useState(0);
  const [difficulty, setDifficulty] = useState<MatchConfig['difficulty']>(initial?.difficulty ?? 'normal');
  const [weapons, setWeapons] = useState(initial?.weapons ?? true);
  const [hover, setHover] = useState<Wrestler | null>(null);

  const start = () => {
    audio.click();
    onStart({ slots, difficulty, weapons });
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Enter') start();
      if (e.code === 'Escape') onBack();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const setCount = (n: number) => {
    audio.click();
    setSlots((s) => defaultSlots(n, s));
    setActive((a) => Math.min(a, n - 1));
  };

  const assign = (id: string) => {
    audio.click();
    setSlots((s) => {
      const next = s.map((x) => ({ ...x }));
      const clash = next.findIndex((x, i) => x.wrestlerId === id && i !== active);
      if (clash >= 0) next[clash].wrestlerId = next[active].wrestlerId;
      next[active].wrestlerId = id;
      return next;
    });
    setActive((a) => (a + 1) % slots.length);
  };

  const cycleControl = (i: number) => {
    audio.click();
    setSlots((s) => {
      const next = s.map((x) => ({ ...x }));
      const cur = CONTROL_ORDER.indexOf(next[i].control);
      // skip human controls already taken by another slot
      for (let k = 1; k <= CONTROL_ORDER.length; k++) {
        const c = CONTROL_ORDER[(cur + k) % CONTROL_ORDER.length];
        if (c === 'cpu' || !next.some((x, j) => j !== i && x.control === c)) {
          next[i].control = c;
          break;
        }
      }
      return next;
    });
  };

  const shown = hover ?? ROSTER.find((r) => r.id === slots[active].wrestlerId)!;

  return (
    <div className="bg-drift h-full w-full overflow-y-auto bg-gradient-to-b from-[#120509] via-[#08080d] to-black">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6">
        <header className="flex items-center justify-between">
          <button onClick={onBack} className="font-display text-sm tracking-widest text-zinc-400 hover:text-white">
            ← BACK
          </button>
          <h2 className="font-display text-outline text-3xl tracking-wide sm:text-4xl">
            MATCH <span className="text-red-600">SETUP</span>
          </h2>
          <div className="w-14" />
        </header>

        {/* match type */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {TYPES.map((t) => (
            <button
              key={t.n}
              onClick={() => setCount(t.n)}
              className={`rounded-lg border-2 px-2 py-3 text-left transition sm:px-4 ${slots.length === t.n ? 'border-red-600 bg-red-600/20' : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'}`}
            >
              <div className="font-display text-lg leading-none tracking-wide sm:text-2xl">{t.name.toUpperCase()}</div>
              <div className="mt-1 text-xs text-zinc-400">{t.sub}</div>
            </button>
          ))}
        </div>

        {/* slots */}
        <div className={`grid gap-2 sm:gap-3 ${slots.length === 2 ? 'grid-cols-2' : slots.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {slots.map((s, i) => {
            const w = ROSTER.find((r) => r.id === s.wrestlerId)!;
            return (
              <div
                key={i}
                onClick={() => setActive(i)}
                className={`relative cursor-pointer overflow-hidden rounded-lg border-2 transition ${active === i ? 'border-yellow-400 shadow-[0_0_24px_rgba(250,204,21,0.25)]' : 'border-zinc-800 hover:border-zinc-600'}`}
                style={{ background: `linear-gradient(160deg, ${w.colour}55, #0b0b10 65%)` }}
              >
                <div className="flex items-center gap-2 p-2 sm:gap-3 sm:p-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-black/40 sm:h-20 sm:w-20">{portraits[w.id] && <img src={portraits[w.id]} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold tracking-widest text-zinc-400">SLOT {i + 1}</div>
                    <div className="font-display truncate text-lg leading-tight sm:text-2xl">{w.name.toUpperCase()}</div>
                    <div className="truncate text-xs text-zinc-400">“{w.nick}”</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleControl(i);
                  }}
                  className={`w-full border-t border-white/10 py-1.5 text-xs font-bold tracking-wider transition hover:bg-white/10 ${s.control === 'cpu' ? 'text-zinc-300' : s.control === 'keyboard' ? 'bg-red-600/30 text-white' : 'bg-blue-600/30 text-white'}`}
                >
                  {CONTROL_LABEL[s.control]} ▾
                </button>
              </div>
            );
          })}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* roster grid */}
          <div>
            <div className="mb-2 text-xs font-bold tracking-widest text-zinc-400">
              PICK A WRESTLER FOR <span className="text-yellow-400">SLOT {active + 1}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {ROSTER.map((w) => {
                const taken = slots.findIndex((s) => s.wrestlerId === w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() => assign(w.id)}
                    onMouseEnter={() => setHover(w)}
                    onMouseLeave={() => setHover(null)}
                    className="group relative overflow-hidden rounded-md border-2 bg-zinc-900 transition hover:-translate-y-0.5"
                    style={{ borderColor: taken >= 0 ? w.colour : '#27272a' }}
                  >
                    <div className="aspect-square" style={{ background: `radial-gradient(circle at 50% 30%, ${w.colour}66, #0b0b10 70%)` }}>
                      {portraits[w.id] && <img src={portraits[w.id]} alt={w.name} className="h-full w-full object-cover transition group-hover:scale-105" />}
                    </div>
                    <div className="font-display truncate bg-black/70 px-1 py-0.5 text-[11px] tracking-wide sm:text-sm">{w.name.toUpperCase()}</div>
                    {taken >= 0 && <div className="absolute right-1 top-1 rounded bg-black/80 px-1.5 text-[10px] font-bold">{taken + 1}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* info + options */}
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="font-display text-2xl leading-none" style={{ color: shown.colour }}>
                {shown.name.toUpperCase()}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                {shown.hometown} · {shown.weight} · {shown.style}
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <StatBar label="POW" v={shown.stats.power} />
                <StatBar label="SPD" v={shown.stats.speed} />
                <StatBar label="TEC" v={shown.stats.technique} />
                <StatBar label="TGH" v={shown.stats.toughness} />
              </div>
              <div className="mt-3 text-xs text-zinc-400">
                Finisher: <span className="font-bold text-yellow-400">{shown.moves.finisherName}</span>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="mb-2 text-xs font-bold tracking-widest text-zinc-400">CPU DIFFICULTY</div>
              <div className="grid grid-cols-3 gap-1">
                {(['easy', 'normal', 'hard'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => (audio.click(), setDifficulty(d))}
                    className={`rounded py-1.5 text-xs font-bold uppercase tracking-wider ${difficulty === d ? 'bg-yellow-400 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex cursor-pointer items-center justify-between text-sm">
                <span className="text-xs font-bold tracking-widest text-zinc-400">WEAPONS AT RINGSIDE</span>
                <input type="checkbox" checked={weapons} onChange={(e) => setWeapons(e.target.checked)} className="h-4 w-4 accent-red-600" />
              </label>
            </div>
            <button onClick={start} className="font-display rounded-lg bg-red-600 py-3 text-3xl tracking-widest text-white shadow-[0_8px_30px_rgba(220,38,38,0.35)] transition hover:bg-red-500 active:scale-[0.98]">
              RING THE BELL
            </button>
          </div>
        </div>

        <ControlsCard />
      </div>
    </div>
  );
}
