import { useGameStore } from '../../stores/game-store';
import { EVENT_TYPE_COLORS } from '@faxhistoria/shared';

export function EventLog() {
  const gameState = useGameStore((s) => s.gameState);

  const events = gameState?.recentEvents ?? [];

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface">
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-text-main">
        Recent Events
      </h3>
      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '300px' }}>
        {events.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-text-secondary">
            No events yet. Submit your first turn!
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {[...events].reverse().map((event, i) => (
              <div
                key={`${event.turnNumber}-${i}`}
                className="rounded-lg px-3 py-2 text-sm hover:bg-surface-hover"
              >
                <div className="flex items-center gap-2 mb-1">
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
