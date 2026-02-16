import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '../../stores/game-store';
import { Header } from './Header';
import { WorldMap } from './WorldMap';
import { ActionPanel } from './ActionPanel';
import { EventLog } from './EventLog';
import { CountryStatsPanel } from './CountryStatsPanel';
import { TurnTimelinePanel } from './TurnTimelinePanel';
import { Spinner } from '../common/Spinner';
import { Button } from '../common/Button';

export function GameUI() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    loadGame,
    gameState,
    gameTurns,
    viewedTurnNumber,
    setViewedTurnNumber,
    jumpToCurrentTurn,
    gameLoading,
    error,
    clearCurrentGame,
  } = useGameStore();
  const roundParam = searchParams.get('round');

  useEffect(() => {
    if (id) {
      loadGame(id);
    }
    return () => {
      clearCurrentGame();
    };
  }, [id, loadGame, clearCurrentGame]);

  useEffect(() => {
    if (!gameState) return;

    const availableTurns = new Set([
      0,
      gameState.turnNumber,
      ...gameTurns.map((turn) => turn.turnNumber),
    ]);
    const parsedRound = roundParam === null ? null : Number.parseInt(roundParam, 10);

    if (
      parsedRound !== null &&
      Number.isInteger(parsedRound) &&
      availableTurns.has(parsedRound)
    ) {
      if (viewedTurnNumber !== parsedRound) {
        setViewedTurnNumber(parsedRound);
      }
      return;
    }

    if (roundParam === null) {
      setViewedTurnNumber(gameState.turnNumber);
    }
  }, [gameState, gameTurns, roundParam, setViewedTurnNumber]);

  useEffect(() => {
    if (!gameState || viewedTurnNumber === null) return;

    const nextParams = new URLSearchParams(searchParams);
    if (viewedTurnNumber === gameState.turnNumber) {
      nextParams.delete('round');
    } else {
      nextParams.set('round', String(viewedTurnNumber));
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [gameState, viewedTurnNumber, searchParams, setSearchParams]);

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

  const activeTurn = viewedTurnNumber ?? gameState.turnNumber;
  const viewingHistory = activeTurn < gameState.turnNumber;
  const turnGap = gameState.turnNumber - activeTurn;

  return (
    <div className="flex h-screen flex-col bg-bg">
      <Header />
      {viewingHistory ? (
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
          <p className="text-sm text-text-secondary">
            Viewing turn {activeTurn} ({turnGap} turn{turnGap === 1 ? '' : 's'} behind
            current). Return to current turn to submit a new action.
          </p>
          <Button
            variant="secondary"
            className="px-3 py-1 text-xs"
            onClick={jumpToCurrentTurn}
          >
            Go to Current Turn
          </Button>
        </div>
      ) : null}
      <div className="flex flex-1 overflow-hidden">
        {/* Map area */}
        <div className="flex-1 overflow-hidden">
          <WorldMap />
        </div>

        {/* Right panel */}
        <div className="flex w-96 flex-col gap-3 overflow-y-auto border-l border-border p-3">
          <TurnTimelinePanel />
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
