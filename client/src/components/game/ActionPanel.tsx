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

interface ActionTemplate {
  id: string;
  label: string;
  prompt: string;
}

interface ReadinessCheck {
  label: string;
  passed: boolean;
}

function computeReadinessChecks(text: string): ReadinessCheck[] {
  const normalized = text.trim();
  const hasClearObjective = normalized.length >= 30;
  const hasTargetOrPartner =
    /\b(with|against|toward|between|target|partner|ally|neighbor|rival)\b/i.test(
      normalized,
    );
  const hasExpectedOutcome =
    /\b(so that|in order to|to reduce|to increase|to secure|to stabilize|to prevent|to gain)\b/i.test(
      normalized,
    );

  return [
    { label: 'Clear objective statement', passed: hasClearObjective },
    { label: 'Specific target or partner', passed: hasTargetOrPartner },
    { label: 'Expected outcome included', passed: hasExpectedOutcome },
  ];
}

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
  const playerCountryName =
    gameState?.countries[gameState.playerCountry]?.displayName ??
    gameState?.playerCountry ??
    'our country';
  const actionTemplates = useMemo<ActionTemplate[]>(
    () => [
      {
        id: 'diplomacy',
        label: 'Diplomatic Push',
        prompt: `Launch a diplomatic initiative led by ${playerCountryName}, proposing a regional de-escalation channel and confidence-building measures.`,
      },
      {
        id: 'economic',
        label: 'Economic Package',
        prompt: `Announce a targeted economic package with one partner country, including trade access and joint infrastructure incentives tied to stability goals.`,
      },
      {
        id: 'security',
        label: 'Security Posture',
        prompt: `Adjust military readiness around one hotspot while simultaneously opening a direct communication line to prevent accidental escalation.`,
      },
      {
        id: 'domestic',
        label: 'Domestic Reform',
        prompt: `Prioritize a domestic reform plan that improves stability and economic resilience before expanding external commitments.`,
      },
    ],
    [playerCountryName],
  );
  const readinessChecks = useMemo(() => computeReadinessChecks(action), [action]);
  const readinessPassed = readinessChecks.filter((check) => check.passed).length;

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
  const applyTemplate = (template: string) => {
    if (turnSubmitting) return;
    const nextAction = action.trim()
      ? `${action.trimEnd()}\n\n${template}`
      : template;
    setAction(nextAction);
  };

  const showingFinalEvents = turnLiveEvents.length > 0;
  const draftCount = turnDraftEvents.length;
  const finalCount = turnLiveEvents.length;

  return (
    <div className="app-panel flex flex-col gap-3 p-4">
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
          <div className="app-panel-soft px-3 py-3">
            <p className="mb-2 text-xs text-text-secondary">
              {viewedTurn ? `Year ${viewedTurn.year}` : 'Historical turn'}
            </p>
            <p className="text-sm leading-relaxed text-text-main">
              {viewedTurn?.playerAction ??
                'No submitted action was found for this turn.'}
            </p>
          </div>
          <div className="app-panel-soft flex items-center justify-between gap-3 px-3 py-2">
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
          <div className="app-panel-soft px-3 py-3">
            <p className="mb-2 text-xs font-medium text-text-main">
              Quick Action Starters
            </p>
            <div className="flex flex-wrap gap-2">
              {actionTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  disabled={turnSubmitting}
                  onClick={() => applyTemplate(template.prompt)}
                  className="cursor-pointer rounded-md border border-border bg-surface/65 px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-primary hover:text-text-main disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
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
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Describe your diplomatic, military, or economic action..."
            maxLength={2000}
            rows={4}
            disabled={turnSubmitting}
            className="app-input resize-none text-sm"
          />
          <div className="app-panel-soft px-3 py-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-text-main">Action Readiness</p>
              <span className="text-[11px] text-text-secondary">
                {readinessPassed}/{readinessChecks.length}
              </span>
            </div>
            <div className="space-y-1">
              {readinessChecks.map((check) => (
                <p key={check.label} className="text-[11px] text-text-secondary">
                  <span
                    className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${
                      check.passed ? 'bg-success' : 'bg-border'
                    }`}
                  />
                  {check.label}
                </p>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-text-secondary">
              Shortcut: Press Cmd/Ctrl + Enter to submit quickly.
            </p>
          </div>
          {(turnSubmitting || turnProgress) && (
            <div className="app-panel-soft px-3 py-2">
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
              <div className="mt-3 rounded-md border border-border bg-surface/70 p-2">
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
                            className="rounded-md border border-border bg-bg/70 px-2 py-2"
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
                            className="rounded-md border border-border bg-bg/70 px-2 py-2"
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
            <Button
              onClick={handleSubmit}
              loading={turnSubmitting}
              disabled={!action.trim()}
            >
              {turnSubmitting ? 'Generating Events...' : 'Submit Turn'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
