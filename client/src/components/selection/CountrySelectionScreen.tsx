import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SELECTABLE_COUNTRIES, INITIAL_COUNTRIES } from '@faxhistoria/shared';
import { useGameStore } from '../../stores/game-store';
import { useUIStore } from '../../stores/ui-store';
import { Button } from '../common/Button';

export function CountrySelectionScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [gameName, setGameName] = useState('');
  const { createGame, gameLoading } = useGameStore();
  const addToast = useUIStore((s) => s.addToast);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!selected || !gameName.trim()) {
      addToast('Please enter a game name and select a country', 'warning');
      return;
    }
    const gameId = await createGame(gameName.trim(), selected);
    if (gameId) {
      navigate(`/game/${gameId}`);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-text-main">New Game</h1>
        <Button variant="secondary" onClick={() => navigate('/lobby')}>
          Back to Lobby
        </Button>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-text-secondary">
            Game Name
          </label>
          <input
            type="text"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="e.g. Cold War Redux"
            maxLength={100}
            className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-text-main outline-none focus:border-primary"
          />
        </div>

        <h2 className="mb-4 text-lg font-semibold text-text-main">
          Select Your Country
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SELECTABLE_COUNTRIES.map((name) => {
            const country = INITIAL_COUNTRIES[name];
            const isSelected = selected === name;

            return (
              <button
                key={name}
                onClick={() => setSelected(name)}
                className={`cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-surface hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: country.color }}
                  />
                  <span className="text-sm font-medium text-text-main truncate">
                    {name}
                  </span>
                </div>
                <div className="text-xs text-text-secondary space-y-0.5">
                  <div>GDP: ${country.gdp}B</div>
                  <div>Pop: {country.population}M</div>
                  <div>Stability: {country.stability}%</div>
                </div>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-6 flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
            <div className="flex-1">
              <p className="text-text-main font-medium">
                Playing as{' '}
                <span style={{ color: INITIAL_COUNTRIES[selected].color }}>
                  {INITIAL_COUNTRIES[selected].displayName}
                </span>
              </p>
              <p className="text-sm text-text-secondary">
                {INITIAL_COUNTRIES[selected].government} -- Led by{' '}
                {INITIAL_COUNTRIES[selected].leader}
              </p>
            </div>
            <Button onClick={handleCreate} loading={gameLoading}>
              Start Game
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
