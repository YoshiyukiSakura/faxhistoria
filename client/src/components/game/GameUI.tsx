import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/game-store';
import { Header } from './Header';
import { WorldMap } from './WorldMap';
import { ActionPanel } from './ActionPanel';
import { EventLog } from './EventLog';
import { CountryStatsPanel } from './CountryStatsPanel';
import { Spinner } from '../common/Spinner';

export function GameUI() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadGame, gameState, gameLoading, error, clearCurrentGame } =
    useGameStore();

  useEffect(() => {
    if (id) {
      loadGame(id);
    }
    return () => {
      clearCurrentGame();
    };
  }, [id, loadGame, clearCurrentGame]);

  if (gameLoading && !gameState) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !gameState) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg">
        <p className="text-danger">{error}</p>
        <button
          onClick={() => navigate('/lobby')}
          className="cursor-pointer text-primary hover:underline"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  if (!gameState) return null;

  return (
    <div className="flex h-screen flex-col bg-bg">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Map area */}
        <div className="flex-1 overflow-hidden">
          <WorldMap />
        </div>

        {/* Right panel */}
        <div className="flex w-96 flex-col gap-3 overflow-y-auto border-l border-border p-3">
          <CountryStatsPanel />
          <ActionPanel />
          <EventLog />

          {gameState.worldNarrative && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-2 text-sm font-semibold text-text-main">
                World Situation
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {gameState.worldNarrative}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
