import { useEffect, useMemo } from 'react';
import { ROSTER } from '../game/roster';
import { getPortraits } from './portraits';

export default function Title({ onStart }: { onStart: () => void }) {
  const portraits = useMemo(() => getPortraits(), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyJ') onStart();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onStart]);

  return (
    <div
      className="bg-drift relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#16060a] via-[#07070c] to-black"
      onClick={onStart}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(196,18,43,0.25),transparent_60%)]" />
      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        <div className="font-display text-sm tracking-[0.5em] text-yellow-400 sm:text-base">LIVE FROM THE ARENA</div>
        <h1 className="font-display text-outline mt-2 text-6xl leading-[0.9] text-white sm:text-8xl md:text-9xl">
          SQUARED
          <br />
          <span className="text-red-600">CIRCLE</span>
          <br />
          MAYHEM
        </h1>
        <div className="mt-6 flex -space-x-3">
          {ROSTER.map((w) => (
            <div key={w.id} className="h-14 w-14 overflow-hidden rounded-full border-2 bg-zinc-900 sm:h-16 sm:w-16" style={{ borderColor: w.colour }}>
              {portraits[w.id] && <img src={portraits[w.id]} alt={w.name} className="h-full w-full object-cover" />}
            </div>
          ))}
        </div>
        <div className="font-display anim-flash mt-10 text-2xl tracking-widest text-white">CLICK OR PRESS ENTER</div>
        <p className="mt-4 max-w-md text-sm text-zinc-400">Strikes, grapples, pinfalls, submissions, top-rope dives and the odd steel chair. One to four wrestlers, keyboard or gamepad.</p>
      </div>
    </div>
  );
}
