import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { useUIStore } from '../../stores/ui-store';
import { Button } from '../common/Button';

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
  const { submitTurn, turnSubmitting, turnProgress, clearTurnProgress } = useGameStore();
  const addToast = useUIStore((s) => s.addToast);

  const handleSubmit = async () => {
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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text-main">Your Action</h3>
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
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-text-secondary">
              {STAGE_LABEL[turnProgress?.stage ?? 'VALIDATING'] ?? 'Processing'}
            </span>
            <span className="font-medium text-text-main">
              {Math.round(turnProgress?.progress ?? 0)}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                turnProgress?.stage === 'FAILED' ? 'bg-danger' : 'bg-primary'
              }`}
              style={{ width: `${Math.max(2, Math.round(turnProgress?.progress ?? 0))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {turnProgress?.message ?? 'Submitting turn...'}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">
          {action.length}/2000
        </span>
        <Button onClick={handleSubmit} loading={turnSubmitting}>
          {turnSubmitting ? 'Submitting...' : 'Submit Turn'}
        </Button>
      </div>
    </div>
  );
}
