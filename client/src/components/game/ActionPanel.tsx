import { useMemo, useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { useUIStore } from '../../stores/ui-store';
import { Button } from '../common/Button';
import { EVENT_TYPE_COLORS } from '@faxhistoria/shared';

const STAGE_LABEL: Record<string, string> = {
  VALIDATING: 'Validating',
  PROCESSING_AI: 'AI Processing',
  AI_RETRY: 'AI Retry',
  APPLYING_EVENTS: 'Applying Events',
  PERSISTING: 'Saving Turn',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

export function ActionPanel() {
  const [action, setAction] = useState('');
  const {
    submitTurn,
    turnSubmitting,
    turnProgress,
    turnLiveEvents,
    turnDraftEvents,
    clearTurnProgress,
  } = useGameStore();
  const gameState = useGameStore((s) => s.gameState);
  const gameTurns = useGameStore((s) => s.gameTurns);
  const viewedTurnNumber = useGameStore((s) => s.viewedTurnNumber);
  const jumpToCurrentTurn = useGameStore((s) => s.jumpToCurrentTurn);
  const addToast = useUIStore((s) => s.addToast);

  const currentTurn = gameState?.turnNumber ?? 0;
  const activeTurn = viewedTurnNumber ?? currentTurn;
  const viewingHistory = activeTurn < currentTurn;
  const viewedTurn = useMemo(
    () => gameTurns.find((turn) => turn.turnNumber === activeTurn),
    [gameTurns, activeTurn],
  );

  const handleSubmit = async () => {
    if (viewingHistory) {
      addToast('Return to current turn to submit a new action', 'warning');
      return;
    }
    if (!action.trim()) {
      addToast('Please describe your action', 'warning');
      return;
    }
    const result = await submitTurn(action.trim());
    if (result) {
      addToast('Turn submitted successfully', 'success');
      setAction('');
    }
  };

  const showingFinalEvents = turnLiveEvents.length > 0;
  const draftCount = turnDraftEvents.length;
  const finalCount = turnLiveEvents.length;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-main">
          {viewingHistory ? 'Submitted Action' : 'Your Action'}
        </h3>
        {viewingHistory ? (
          <span className="text-xs text-text-secondary">
            Turn {activeTurn}
          </span>
        ) : null}
      </div>

      {viewingHistory ? (
        <>
          <div className="rounded-lg border border-border bg-bg px-3 py-3">
            <p className="mb-2 text-xs text-text-secondary">
              {viewedTurn ? `Year ${viewedTurn.year}` : 'Historical turn'}
            </p>
            <p className="text-sm leading-relaxed text-text-main">
              {viewedTurn?.playerAction ??
                'No submitted action was found for this turn.'}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2">
            <p className="text-xs text-text-secondary">
              You are viewing a historical turn. Jump back to the current turn to
              submit your next action.
            </p>
            <Button
              variant="secondary"
              className="shrink-0 px-3 py-1.5 text-xs"
              onClick={jumpToCurrentTurn}
            >
              Current Turn
            </Button>
          </div>
        </>
      ) : (
        <>
          <textarea
            value={action}
            onChange={(e) => {
              if (
                !turnSubmitting &&
                (turnProgress?.stage === 'COMPLETED' || turnProgress?.stage === 'FAILED')
              ) {
                clearTurnProgress();
              }
              setAction(e.target.value);
            }}
            placeholder="Describe your diplomatic, military, or economic action..."
            maxLength={2000}
            rows={4}
            disabled={turnSubmitting}
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
          />
          {(turnSubmitting || turnProgress) && (
            <div className="rounded-lg border border-border bg-bg px-3 py-2">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-text-main">
                  {STAGE_LABEL[turnProgress?.stage ?? 'VALIDATING'] ?? 'Processing'}
                </span>
                {turnSubmitting && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary">
                {turnProgress?.message ?? 'Submitting turn...'}
              </p>
              <div className="mt-3 rounded-md border border-border bg-surface p-2">
                <div className="mb-2 flex items-center justify-between text-[11px] text-text-secondary">
                  <span>
                    {showingFinalEvents ? 'Generated Events' : 'Live Event Drafts'}
                  </span>
                  <span>{showingFinalEvents ? finalCount : draftCount}</span>
                </div>
                {!showingFinalEvents && turnDraftEvents.length === 0 ? (
                  <p className="text-xs text-text-secondary animate-pulse">
                    Waiting for AI to emit events...
                  </p>
                ) : (
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {showingFinalEvents
                      ? turnLiveEvents.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-md border border-border bg-bg px-2 py-2"
                          >
                            <div className="mb-1 flex items-center gap-2 text-[11px] text-text-secondary">
                              <span
                                className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    EVENT_TYPE_COLORS[event.type] ?? '#6B7280',
                                }}
                              />
                              <span className="font-medium">{event.type}</span>
                              <span className="ml-auto">
                                {event.sequence}/{event.total}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-text-main">
                              {event.description}
                            </p>
                          </div>
                        ))
                      : turnDraftEvents.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-md border border-border bg-bg px-2 py-2"
                          >
                            <div className="mb-1 flex items-center gap-2 text-[11px] text-text-secondary">
                              <span
                                className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    EVENT_TYPE_COLORS[event.type] ?? '#6B7280',
                                }}
                              />
                              <span className="font-medium">{event.type}</span>
                              <span className="ml-auto">
                                Draft #{event.sequence}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-text-main">
                              {event.description || '...'}
                              {!event.isFinal && turnSubmitting ? (
                                <span className="ml-1 inline-block animate-pulse text-text-secondary">
                                  ...
                                </span>
                              ) : null}
                            </p>
                          </div>
                        ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              {action.length}/2000
            </span>
            <Button onClick={handleSubmit} loading={turnSubmitting}>
              {turnSubmitting ? 'Generating Events...' : 'Submit Turn'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
