import { useMemo } from 'react';
import { useGameStore } from '../../stores/game-store';
import { Button } from '../common/Button';

interface TimelineTurnItem {
  turnNumber: number;
  year: number;
  playerAction: string;
  eventCount: number;
  isInitial: boolean;
}

function trimAction(action: string, max = 70): string {
  if (action.length <= max) return action;
  return `${action.slice(0, max)}...`;
}

export function TurnTimelinePanel() {
  const gameState = useGameStore((s) => s.gameState);
  const gameTurns = useGameStore((s) => s.gameTurns);
  const turnSubmitting = useGameStore((s) => s.turnSubmitting);
  const viewedTurnNumber = useGameStore((s) => s.viewedTurnNumber);
  const setViewedTurnNumber = useGameStore((s) => s.setViewedTurnNumber);
  const jumpToCurrentTurn = useGameStore((s) => s.jumpToCurrentTurn);

  if (!gameState) return null;

  const currentTurn = gameState.turnNumber;
  const activeTurn = viewedTurnNumber ?? currentTurn;
  const viewingHistory = activeTurn < currentTurn;
  const startYear = gameState.currentYear - currentTurn;

  const timelineTurns = useMemo<TimelineTurnItem[]>(() => {
    const byTurn = new Map<number, TimelineTurnItem>();

    byTurn.set(0, {
      turnNumber: 0,
      year: startYear,
      playerAction: 'Campaign begins',
      eventCount: 0,
      isInitial: true,
    });

    for (const turn of gameTurns) {
      byTurn.set(turn.turnNumber, {
        turnNumber: turn.turnNumber,
        year: turn.year,
        playerAction: turn.playerAction,
        eventCount: turn.events.length,
        isInitial: false,
      });
    }

    if (!byTurn.has(currentTurn)) {
      byTurn.set(currentTurn, {
        turnNumber: currentTurn,
        year: gameState.currentYear,
        playerAction: 'Current world state',
        eventCount: 0,
        isInitial: currentTurn === 0,
      });
    }

    return [...byTurn.values()].sort((a, b) => b.turnNumber - a.turnNumber);
  }, [currentTurn, gameState.currentYear, gameTurns, startYear]);

  const turnNumbersAsc = useMemo(
    () => timelineTurns.map((turn) => turn.turnNumber).sort((a, b) => a - b),
    [timelineTurns],
  );

  const currentIndex = turnNumbersAsc.indexOf(activeTurn);
  const olderTurn =
    currentIndex > 0 ? turnNumbersAsc[currentIndex - 1] : null;
  const newerTurn =
    currentIndex >= 0 && currentIndex < turnNumbersAsc.length - 1
      ? turnNumbersAsc[currentIndex + 1]
      : null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-main">Timeline</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Viewing turn {activeTurn} / {currentTurn}
          </p>
        </div>
        {viewingHistory ? (
          <Button
            variant="secondary"
            onClick={jumpToCurrentTurn}
            className="px-3 py-1 text-xs"
          >
            Current Turn
          </Button>
        ) : null}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          className="w-full py-1.5 text-xs"
          disabled={turnSubmitting || olderTurn === null}
          onClick={() => olderTurn !== null && setViewedTurnNumber(olderTurn)}
        >
          Older Turn
        </Button>
        <Button
          variant="secondary"
          className="w-full py-1.5 text-xs"
          disabled={turnSubmitting || newerTurn === null}
          onClick={() => newerTurn !== null && setViewedTurnNumber(newerTurn)}
        >
          Newer Turn
        </Button>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {timelineTurns.map((turn) => {
          const selected = turn.turnNumber === activeTurn;
          return (
            <button
              key={turn.turnNumber}
              type="button"
              disabled={turnSubmitting}
              onClick={() => setViewedTurnNumber(turn.turnNumber)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                selected
                  ? 'border-primary bg-primary/15'
                  : 'border-border bg-bg hover:border-primary/70'
              } ${turnSubmitting ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text-main">
                  Turn {turn.turnNumber}
                </span>
                <span className="text-[11px] text-text-secondary">
                  Year {turn.year}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                {turn.isInitial ? turn.playerAction : trimAction(turn.playerAction)}
              </p>
              {!turn.isInitial ? (
                <p className="mt-1 text-[11px] text-text-secondary">
                  {turn.eventCount} event{turn.eventCount === 1 ? '' : 's'}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
      {turnSubmitting ? (
        <p className="mt-2 text-[11px] text-text-secondary">
          Timeline navigation is temporarily locked while turn processing is in progress.
        </p>
      ) : null}
    </div>
  );
}
