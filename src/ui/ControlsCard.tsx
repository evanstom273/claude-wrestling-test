const ROWS: [string, string, string][] = [
  ['Move', 'WASD / Arrows', 'Left stick'],
  ['Attack', 'J or Z', 'X / □'],
  ['Grab', 'K or X', 'A / ✕'],
  ['Run (hold)', 'L, C or Shift', 'RB / RT'],
  ['Pin · Pick up · Climb', 'I or V', 'B / ○'],
  ['Taunt · Finisher', 'U or Space', 'Y / △'],
  ['Camera', 'Q / E', 'Right stick'],
  ['Pause', 'Esc / P', 'Start'],
];

const TIPS = [
  'Grab, then Attack or Grab (with or without a direction) for different moves.',
  'Grab from behind for suplexes. Grab + Run sends them into the ropes.',
  'Fill the yellow momentum bar, then Taunt while grappling for your finisher.',
  'Grab a downed opponent to pick them up, or Grab + direction for a submission.',
  'Pin a downed opponent. When pinned or trapped, MASH buttons to escape.',
  'Push against the ropes to leave the ring. Climb a corner and Attack to fly.',
];

export default function ControlsCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid gap-4 rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 ${compact ? '' : 'md:grid-cols-2'}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-widest text-zinc-500">
            <th className="pb-1 font-bold">ACTION</th>
            <th className="pb-1 font-bold">KEYBOARD</th>
            <th className="pb-1 font-bold">GAMEPAD</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([a, k, p]) => (
            <tr key={a} className="border-t border-zinc-800/80">
              <td className="py-1 pr-2 font-semibold text-zinc-200">{a}</td>
              <td className="py-1 pr-2 font-mono text-xs text-yellow-300">{k}</td>
              <td className="py-1 font-mono text-xs text-sky-300">{p}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-col gap-1.5 text-xs text-zinc-300">
        <li className="text-[10px] font-bold tracking-widest text-zinc-500">HOW TO WRESTLE</li>
        {TIPS.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="text-red-500">▸</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
