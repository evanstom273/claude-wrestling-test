import { useState } from 'react';
import Title from './ui/Title';
import Setup from './ui/Setup';
import MatchView from './ui/MatchView';
import type { MatchConfig } from './game/Game';
import { audio } from './game/Audio';
import { ROSTER } from './game/roster';

// ?demo=2..4 jumps straight into a CPU match (handy for testing / attract mode)
function demoConfig(): MatchConfig | null {
  const n = Number(new URLSearchParams(location.search).get('demo'));
  if (!(n >= 2 && n <= 4)) return null;
  const ids = [...ROSTER].sort(() => Math.random() - 0.5).slice(0, n).map((r) => r.id);
  const p = new URLSearchParams(location.search);
  if (p.get('w')) p.get('w')!.split(',').forEach((id, i) => (ids[i] = id));
  const human = p.get('human') === '1';
  return { slots: ids.map((id, i) => ({ wrestlerId: id, control: human && i === 0 ? 'keyboard' : 'cpu' })), difficulty: (p.get('diff') as MatchConfig['difficulty']) ?? 'hard', weapons: true };
}

type Screen = 'title' | 'setup' | 'match';

export default function App() {
  const [config, setConfig] = useState<MatchConfig | null>(demoConfig);
  const [screen, setScreen] = useState<Screen>(config ? 'match' : 'title');
  const [matchKey, setMatchKey] = useState(0);

  return (
    <div className="h-full w-full overflow-hidden select-none">
      {screen === 'title' && (
        <Title
          onStart={() => {
            audio.ensure();
            audio.click();
            setScreen('setup');
          }}
        />
      )}
      {screen === 'setup' && (
        <Setup
          initial={config}
          onBack={() => setScreen('title')}
          onStart={(c) => {
            setConfig(c);
            setMatchKey((k) => k + 1);
            setScreen('match');
          }}
        />
      )}
      {screen === 'match' && config && (
        <MatchView
          key={matchKey}
          config={config}
          onRematch={() => setMatchKey((k) => k + 1)}
          onQuit={() => setScreen('setup')}
        />
      )}
    </div>
  );
}
