import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SELECTABLE_COUNTRIES, INITIAL_COUNTRIES } from '@faxhistoria/shared';
import { useGameStore } from '../../stores/game-store';
import { appTheme } from '../../theme/theme';
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
    <div className={appTheme.pageShell}>
      <div className={appTheme.pageBackground} aria-hidden />
      <div className={appTheme.pageGrid} aria-hidden />
      <div className={appTheme.pageContent}>
        <header className={`${appTheme.pageHeader} px-6 py-4`}>
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <h1 className="text-xl font-bold text-text-main">New Game</h1>
            <Button variant="secondary" onClick={() => navigate('/lobby')}>
              Back to Lobby
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-6">
          <div className={`${appTheme.panel} mb-6 p-5`}>
            <label className="mb-2 block text-sm font-medium text-text-secondary">
              Game Name
            </label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="e.g. Cold War Redux"
              maxLength={100}
              className={`${appTheme.input} max-w-md`}
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
                  className={`cursor-pointer rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-cyan-200/65 bg-cyan-300/12'
                      : `${appTheme.card}`
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: country.color }}
                    />
                    <span className="truncate text-sm font-medium text-text-main">
                      {name}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-xs text-text-secondary">
                    <div>GDP: ${country.gdp}B</div>
                    <div>Pop: {country.population}M</div>
                    <div>Stability: {country.stability}%</div>
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className={`${appTheme.panel} mt-6 flex items-center gap-4 p-4`}>
              <div className="flex-1">
                <p className="font-medium text-text-main">
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
    </div>
  );
}
