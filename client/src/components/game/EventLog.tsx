import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { EVENT_TYPE_COLORS } from '@faxhistoria/shared';
import { toSafeImageUrl } from '../../services/api';

interface DisplayEvent {
  id: string;
  eventType: string;
  description: string;
  sequenceLabel: string;
  turnLabel: string;
  imageUrl?: string;
}

export function EventLog() {
  const gameState = useGameStore((s) => s.gameState);
  const gameTurns = useGameStore((s) => s.gameTurns);
  const viewedTurnNumber = useGameStore((s) => s.viewedTurnNumber);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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
  const displayEvents = useMemo<DisplayEvent[]>(() => {
    if (viewingHistory) {
      const turnLabel = viewedTurn ? `Year ${viewedTurn.year}, Turn ${viewedTurn.turnNumber}` : 'Historical turn';
      return historicalEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        description: event.eventData.description ?? 'No event description',
        sequenceLabel: `#${event.sequence + 1}`,
        turnLabel,
        imageUrl: event.eventData.imageUrl,
      }));
    }

    return [...recentEvents].reverse().map((event, index) => ({
      id: `${event.turnNumber}-${event.year}-${index}`,
      eventType: event.eventType,
      description: event.description,
      sequenceLabel: `#${index + 1}`,
      turnLabel: `Year ${event.year}, Turn ${event.turnNumber}`,
      imageUrl: event.imageUrl,
    }));
  }, [historicalEvents, recentEvents, viewedTurn, viewingHistory]);
  const activeEvent = displayEvents[activeImageIndex] ?? null;
  const activeImageUrl = useMemo(
    () => toSafeImageUrl(activeEvent?.imageUrl),
    [activeEvent?.imageUrl],
  );

  useEffect(() => {
    if (displayEvents.length === 0) {
      setActiveImageIndex(0);
      return;
    }

    const firstWithImage = displayEvents.findIndex((event) => Boolean(event.imageUrl));
    setActiveImageIndex(firstWithImage >= 0 ? firstWithImage : 0);
  }, [activeTurn, displayEvents]);

  return (
    <div className="app-panel flex flex-col">
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-text-main">
        {viewingHistory ? `Turn ${activeTurn} Events` : 'Recent Events'}
      </h3>
      <div className="flex-1 overflow-y-auto p-2">
        {displayEvents.length > 0 ? (
          <div className="mb-2 rounded-lg border border-border bg-bg/65 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-text-main">Event Image</p>
              <p className="text-[11px] text-text-secondary">
                {activeImageIndex + 1}/{displayEvents.length}
              </p>
            </div>
            <div className="relative mb-2 aspect-[4/3] overflow-hidden rounded-md border border-border bg-bg">
              {activeImageUrl ? (
                <img
                  src={activeImageUrl}
                  alt={activeEvent.description}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-center text-xs text-text-secondary">
                  No image generated for this event
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-main transition hover:border-primary/70 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setActiveImageIndex((current) => Math.max(0, current - 1))}
                disabled={activeImageIndex === 0}
              >
                Previous Event
              </button>
              <button
                type="button"
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-main transition hover:border-primary/70 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() =>
                  setActiveImageIndex((current) =>
                    Math.min(displayEvents.length - 1, current + 1),
                  )
                }
                disabled={activeImageIndex >= displayEvents.length - 1}
              >
                Next Event
              </button>
            </div>
            {activeEvent ? (
              <p className="mt-2 text-[11px] text-text-secondary">
                {activeEvent.eventType} · {activeEvent.turnLabel} · {activeEvent.sequenceLabel}
              </p>
            ) : null}
          </div>
        ) : null}
        {viewingHistory ? (
          historicalEvents.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-text-secondary">
              No events were recorded for this historical turn.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {displayEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={`rounded-lg px-3 py-2 text-sm hover:bg-surface-hover/70 ${
                    index === activeImageIndex ? 'ring-1 ring-primary/65' : ''
                  }`}
                  onClick={() => setActiveImageIndex(index)}
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
                      {event.sequenceLabel}
                    </span>
                  </div>
                  <p className="text-text-main">{event.description}</p>
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
            {displayEvents.map((event, index) => (
              <div
                key={event.id}
                className={`rounded-lg px-3 py-2 text-sm hover:bg-surface-hover/70 ${
                  index === activeImageIndex ? 'ring-1 ring-primary/65' : ''
                }`}
                onClick={() => setActiveImageIndex(index)}
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
                    {event.eventType} -- {event.turnLabel}
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
