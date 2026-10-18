import { useRef, useState } from 'react';
import { input } from '../game/Input';

const BTNS: { a: 'attack' | 'grab' | 'pick' | 'taunt'; label: string; cls: string }[] = [
  { a: 'taunt', label: 'TAUNT', cls: 'bg-yellow-500/70 col-start-2' },
  { a: 'attack', label: 'HIT', cls: 'bg-red-600/70 col-start-1 row-start-2' },
  { a: 'grab', label: 'GRAB', cls: 'bg-sky-600/70 col-start-3 row-start-2' },
  { a: 'pick', label: 'PIN', cls: 'bg-emerald-600/70 col-start-2 row-start-3' },
];

/** Virtual stick + buttons for phones and tablets. Drives the keyboard player. */
export default function TouchControls() {
  const base = useRef<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const [run, setRun] = useState(false);
  const R = 50;

  const move = (cx: number, cy: number) => {
    const b = base.current!;
    let dx = cx - b.x;
    let dy = cy - b.y;
    const l = Math.hypot(dx, dy);
    if (l > R) {
      dx = (dx / l) * R;
      dy = (dy / l) * R;
    }
    setKnob({ x: dx, y: dy });
    input.touchMove.x = dx / R;
    input.touchMove.y = -dy / R;
  };

  return (
    <>
      <div
        className="absolute bottom-0 left-0 h-1/2 w-1/2 touch-none"
        onPointerDown={(e) => {
          base.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => base.current?.id === e.pointerId && move(e.clientX, e.clientY)}
        onPointerUp={() => {
          base.current = null;
          setKnob(null);
          input.touchMove.x = input.touchMove.y = 0;
        }}
        onPointerCancel={() => {
          base.current = null;
          setKnob(null);
          input.touchMove.x = input.touchMove.y = 0;
        }}
      >
        {knob && base.current && (
          <div className="pointer-events-none fixed h-28 w-28 rounded-full border-2 border-white/30 bg-white/10" style={{ left: base.current.x - 56, top: base.current.y - 56 }}>
            <div className="absolute h-12 w-12 rounded-full bg-white/50" style={{ left: 32 + knob.x, top: 32 + knob.y }} />
          </div>
        )}
      </div>
      <div className="absolute bottom-14 right-3 grid touch-none grid-cols-3 grid-rows-3 gap-1">
        {BTNS.map((b) => (
          <button
            key={b.a}
            className={`h-14 w-14 rounded-full text-[11px] font-extrabold text-white shadow-lg active:scale-90 ${b.cls}`}
            onPointerDown={(e) => {
              e.preventDefault();
              input.touchPress(b.a);
            }}
          >
            {b.label}
          </button>
        ))}
        <button
          className={`col-start-3 row-start-3 h-14 w-14 rounded-full text-[11px] font-extrabold text-white shadow-lg ${run ? 'bg-orange-500' : 'bg-zinc-600/70'}`}
          onPointerDown={(e) => {
            e.preventDefault();
            setRun(true);
            input.touchRun = true;
          }}
          onPointerUp={() => {
            setRun(false);
            input.touchRun = false;
          }}
          onPointerLeave={() => {
            setRun(false);
            input.touchRun = false;
          }}
        >
          RUN
        </button>
      </div>
    </>
  );
}
