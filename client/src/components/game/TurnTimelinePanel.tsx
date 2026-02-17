import { useMemo } from 'react';
import { useGameStore } from '../../stores/game-store';
import { Button } from '../common/Button';

interface TimelineTurnItem {
  turnNumber: number;
  year: number;
  playerAction: string;
  eventCount: number;
  eventTypes: string[];
  isInitial: boolean;
}

const KEY_MOMENT_EVENT_TYPES = new Set(['WAR', 'ANNEXATION', 'PEACE', 'ALLIANCE']);

function trimAction(action: string, max = 70): string {
  if (action.length <= max) return action;
  return `${action.slice(0, max)}...`;
}

function isKeyMoment(turn: TimelineTurnItem): boolean {
  if (turn.isInitial) return false;
  return (
    turn.eventCount >= 3 ||
    turn.eventTypes.some((eventType) => KEY_MOMENT_EVENT_TYPES.has(eventType))
  );
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
      eventTypes: [],
      isInitial: true,
    });

    for (const turn of gameTurns) {
      byTurn.set(turn.turnNumber, {
        turnNumber: turn.turnNumber,
        year: turn.year,
        playerAction: turn.playerAction,
        eventCount: turn.events.length,
        eventTypes: turn.events.map((event) => event.eventType),
        isInitial: false,
      });
    }

    if (!byTurn.has(currentTurn)) {
      byTurn.set(currentTurn, {
        turnNumber: currentTurn,
        year: gameState.currentYear,
        playerAction: 'Current world state',
        eventCount: 0,
        eventTypes: [],
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
  const keyTurnsAsc = useMemo(
    () =>
      [...timelineTurns]
        .filter((turn) => isKeyMoment(turn))
        .map((turn) => turn.turnNumber)
        .sort((a, b) => a - b),
    [timelineTurns],
  );
  const previousKeyTurn =
    [...keyTurnsAsc].reverse().find((turnNumber) => turnNumber < activeTurn) ?? null;
  const nextKeyTurn =
    keyTurnsAsc.find((turnNumber) => turnNumber > activeTurn) ?? null;
  const keyMomentCount = keyTurnsAsc.length;

  return (
    <div className="app-panel flex h-full min-h-0 flex-col p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-main">Timeline</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Viewing turn {activeTurn} / {currentTurn}
          </p>
          <p className="mt-1 text-[11px] text-text-secondary">
            Key moments detected: {keyMomentCount}
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

      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          className="w-full py-1.5 text-xs"
          disabled={turnSubmitting || olderTurn === null}
          onClick={() => olderTurn !== null && setViewedTurnNumber(olderTurn)}
        >
          Back 1 Turn
        </Button>
        <Button
          variant="secondary"
          className="w-full py-1.5 text-xs"
          disabled={turnSubmitting || newerTurn === null}
          onClick={() => newerTurn !== null && setViewedTurnNumber(newerTurn)}
        >
          Forward 1 Turn
        </Button>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          className="w-full py-1.5 text-xs"
          disabled={turnSubmitting || previousKeyTurn === null}
          onClick={() => previousKeyTurn !== null && setViewedTurnNumber(previousKeyTurn)}
        >
          Previous Key
        </Button>
        <Button
          variant="secondary"
          className="w-full py-1.5 text-xs"
          disabled={turnSubmitting || nextKeyTurn === null}
          onClick={() => nextKeyTurn !== null && setViewedTurnNumber(nextKeyTurn)}
        >
          Next Key
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {timelineTurns.map((turn) => {
          const selected = turn.turnNumber === activeTurn;
          const keyMoment = isKeyMoment(turn);
          const primaryEventType = turn.eventTypes[0];
          return (
            <button
              key={turn.turnNumber}
              type="button"
              disabled={turnSubmitting}
              onClick={() => setViewedTurnNumber(turn.turnNumber)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                selected
                  ? 'border-primary bg-primary/15'
                  : 'border-border bg-bg/70 hover:border-primary/70'
              } ${turnSubmitting ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text-main">
                  Turn {turn.turnNumber}
                </span>
                <div className="flex items-center gap-2">
                  {keyMoment ? (
                    <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                      KEY
                    </span>
                  ) : null}
                  <span className="text-[11px] text-text-secondary">Year {turn.year}</span>
                </div>
              </div>
              <p className="text-xs text-text-secondary">
                {turn.isInitial ? turn.playerAction : trimAction(turn.playerAction)}
              </p>
              {!turn.isInitial ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-text-secondary">
                    {turn.eventCount} event{turn.eventCount === 1 ? '' : 's'}
                  </p>
                  {primaryEventType ? (
                    <p className="text-[10px] uppercase tracking-wide text-text-secondary">
                      {primaryEventType.replace('_', ' ')}
                    </p>
                  ) : null}
                </div>
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
