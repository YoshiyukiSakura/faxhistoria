import { useMemo } from 'react';
import { useGameStore } from '../../stores/game-store';
import { EVENT_TYPE_COLORS } from '@faxhistoria/shared';

export function EventLog() {
  const gameState = useGameStore((s) => s.gameState);
  const gameTurns = useGameStore((s) => s.gameTurns);
  const viewedTurnNumber = useGameStore((s) => s.viewedTurnNumber);

  if (!gameState) return null;

  const currentTurn = gameState.turnNumber;
  const activeTurn = viewedTurnNumber ?? currentTurn;
  const viewingHistory = activeTurn < currentTurn;
  const viewedTurn = useMemo(
    () => gameTurns.find((turn) => turn.turnNumber === activeTurn),
    [gameTurns, activeTurn],
  );

  const recentEvents = gameState.recentEvents ?? [];
  const historicalEvents = useMemo(
    () => [...(viewedTurn?.events ?? [])].sort((a, b) => a.sequence - b.sequence),
    [viewedTurn],
  );

  return (
    <div className="app-panel flex flex-col">
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-text-main">
        {viewingHistory ? `Turn ${activeTurn} Events` : 'Recent Events'}
      </h3>
      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '300px' }}>
        {viewingHistory ? (
          historicalEvents.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-text-secondary">
              No events were recorded for this historical turn.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {historicalEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-surface-hover/70"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          EVENT_TYPE_COLORS[event.eventType] ?? '#6B7280',
                      }}
                    />
                    <span className="text-xs font-medium text-text-secondary">
                      {event.eventType}
                    </span>
                    <span className="ml-auto text-[11px] text-text-secondary">
                      #{event.sequence + 1}
                    </span>
                  </div>
                  <p className="text-text-main">
                    {event.eventData.description ?? 'No event description'}
                  </p>
                </div>
              ))}
            </div>
          )
        ) : recentEvents.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-text-secondary">
            No events yet. Submit your first turn!
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {[...recentEvents].reverse().map((event, i) => (
              <div
                key={`${event.turnNumber}-${i}`}
                className="rounded-lg px-3 py-2 text-sm hover:bg-surface-hover/70"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        EVENT_TYPE_COLORS[event.eventType] ?? '#6B7280',
                    }}
                  />
                  <span className="text-xs font-medium text-text-secondary">
                    {event.eventType} -- Year {event.year}, Turn {event.turnNumber}
                  </span>
                </div>
                <p className="text-text-main">{event.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
