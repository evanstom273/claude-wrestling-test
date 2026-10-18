import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game, type MatchConfig } from '../game/Game';
import { hud } from '../game/hud';
import ControlsCard from './ControlsCard';
import TouchControls from './TouchControls';
import { audio } from '../game/Audio';

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MatchView({ config, onRematch, onQuit }: { config: MatchConfig; onRematch: () => void; onQuit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const s = useSyncExternalStore(hud.subscribe, hud.get);
  const [help, setHelp] = useState(false);
  const [muted, setMuted] = useState(audio.muted);
  const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  useEffect(() => {
    const g = new Game(ref.current!, config);
    gameRef.current = g;
    (window as unknown as { __game: Game }).__game = g;
    return () => g.dispose();
  }, [config]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') setHelp((h) => !h);
      if (e.code === 'KeyM') {
        audio.setMuted(!audio.muted);
        setMuted(audio.muted);
      }
      if (s.result && (e.code === 'Enter' || e.code === 'KeyR')) onRematch();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [s.result, onRematch]);

  const many = s.wrestlers.length > 2;

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="absolute inset-0" />

      {/* top bar: wrestler panels */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className={`grid flex-1 gap-2 ${many ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
          {s.wrestlers.map((w, i) => {
            const right = !many && i === 1;
            const hp = Math.max(0, w.hp);
            const hpCol = hp > 60 ? '#4ade80' : hp > 30 ? '#facc15' : '#ef4444';
            const special = w.spirit >= 100;
            return (
              <div key={w.id} className={`flex max-w-sm flex-col ${right ? 'items-end justify-self-end text-right' : ''}`}>
                <div className={`flex items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider"
                    style={{ background: w.player === 0 ? '#dc2626' : w.player === 1 ? '#2563eb' : '#3f3f46' }}
                  >
                    {w.player >= 0 ? `P${w.player + 1}` : 'CPU'}
                  </span>
                  <span className="font-display text-outline truncate text-lg leading-none tracking-wide sm:text-2xl" style={{ color: w.colour }}>
                    {w.name.toUpperCase()}
                  </span>
                </div>
                <div className="mt-1 h-3 w-full overflow-hidden rounded-sm border border-black/60 bg-black/60 sm:h-4">
                  <div className={`h-full transition-[width] duration-200 ${right ? 'ml-auto' : ''}`} style={{ width: `${hp}%`, background: `linear-gradient(180deg, ${hpCol}, ${hpCol}aa)` }} />
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-sm bg-black/60">
                  <div className={`h-full ${special ? 'anim-flash' : ''} ${right ? 'ml-auto' : ''}`} style={{ width: `${Math.min(100, w.spirit)}%`, background: special ? '#fde047' : '#ca8a04' }} />
                </div>
                {special && <div className="font-display anim-flash mt-0.5 text-xs tracking-widest text-yellow-300">SPECIAL READY</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* timer */}
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 sm:top-3">
        {!many && <div className="font-display text-outline rounded bg-black/50 px-3 py-0.5 text-xl tabular-nums tracking-wider sm:text-2xl">{fmt(s.time)}</div>}
      </div>

      {/* banner */}
      {s.banner && (
        <div key={s.banner.id} className="pointer-events-none absolute inset-x-0 top-[28%] flex flex-col items-center px-4 text-center">
          <div className="anim-pop font-display text-outline text-6xl leading-none tracking-wide text-white sm:text-8xl" style={{ ['--dur' as string]: `${Math.max(0.8, s.banner.until - s.now + 0.2)}s` }}>
            {s.banner.text}
          </div>
          {s.banner.sub && <div className="anim-pop font-display text-outline mt-2 text-xl tracking-widest text-yellow-300 sm:text-3xl">{s.banner.sub}</div>}
        </div>
      )}

      {/* mash prompt */}
      {s.mash && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[22%] flex flex-col items-center">
          <div className="font-display text-outline anim-flash text-2xl tracking-widest text-white sm:text-4xl">{s.mash.label}</div>
          <div className="mt-2 h-4 w-64 overflow-hidden rounded border-2 border-black bg-zinc-800 sm:w-80">
            <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: `${Math.min(100, s.mash.value * 100)}%` }} />
          </div>
          {s.mash.danger > 0 && (
            <div className="mt-1 h-2 w-64 overflow-hidden rounded bg-zinc-900 sm:w-80">
              <div className="h-full bg-red-600" style={{ width: `${Math.min(100, s.mash.danger * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {/* commentary */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[70%] flex-col gap-1 sm:max-w-md">
        {s.lines.map((l) => (
          <div key={l.id} className="anim-slide w-fit rounded bg-black/65 px-2 py-1 text-xs font-semibold sm:text-sm" style={{ borderLeft: `3px solid ${l.colour ?? '#a1a1aa'}` }}>
            {l.text}
          </div>
        ))}
      </div>

      {/* corner buttons */}
      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          onClick={() => {
            audio.setMuted(!audio.muted);
            setMuted(audio.muted);
          }}
          className="rounded bg-black/60 px-2 py-1 text-xs font-bold text-zinc-300 hover:text-white"
        >
          {muted ? 'SOUND OFF' : 'SOUND ON'}
        </button>
        <button onClick={() => setHelp((h) => !h)} className="rounded bg-black/60 px-2 py-1 text-xs font-bold text-zinc-300 hover:text-white">
          CONTROLS (H)
        </button>
        <button onClick={() => gameRef.current?.togglePause()} className="rounded bg-black/60 px-2 py-1 text-xs font-bold text-zinc-300 hover:text-white">
          PAUSE
        </button>
      </div>

      {touch && !s.result && <TouchControls />}

      {help && !s.paused && (
        <div className="absolute inset-x-0 top-24 mx-auto w-[min(92%,760px)]" onClick={() => setHelp(false)}>
          <ControlsCard />
        </div>
      )}

      {s.paused && !s.result && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-3xl flex-col items-center gap-4">
            <div className="font-display text-outline text-6xl tracking-wide">PAUSED</div>
            <div className="flex gap-3">
              <button onClick={() => gameRef.current?.togglePause()} className="font-display rounded bg-red-600 px-6 py-2 text-2xl tracking-wider hover:bg-red-500">
                RESUME
              </button>
              <button onClick={onRematch} className="font-display rounded bg-zinc-700 px-6 py-2 text-2xl tracking-wider hover:bg-zinc-600">
                RESTART
              </button>
              <button onClick={onQuit} className="font-display rounded bg-zinc-800 px-6 py-2 text-2xl tracking-wider hover:bg-zinc-700">
                QUIT
              </button>
            </div>
            <ControlsCard />
          </div>
        </div>
      )}

      {s.result && (
        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 sm:items-center">
          <div className="flex flex-col items-center text-center">
            <div className="font-display tracking-[0.4em] text-yellow-400">YOUR WINNER</div>
            <div className="font-display text-outline text-6xl leading-none sm:text-8xl" style={{ color: s.result.colour }}>
              {s.result.winner.toUpperCase()}
            </div>
            <div className="mt-2 text-zinc-300">
              defeated {s.result.loser} {s.result.method} in {fmt(s.result.time)}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={onRematch} className="font-display rounded bg-red-600 px-6 py-2 text-2xl tracking-wider hover:bg-red-500">
                REMATCH
              </button>
              <button onClick={onQuit} className="font-display rounded bg-zinc-800 px-6 py-2 text-2xl tracking-wider hover:bg-zinc-700">
                NEW MATCH
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
