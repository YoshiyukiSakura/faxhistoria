import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { useUIStore } from '../../stores/ui-store';
import { Button } from '../common/Button';

export function ActionPanel() {
  const [action, setAction] = useState('');
  const { submitTurn, turnSubmitting } = useGameStore();
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
        onChange={(e) => setAction(e.target.value)}
        placeholder="Describe your diplomatic, military, or economic action..."
        maxLength={2000}
        rows={4}
        className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">
          {action.length}/2000
        </span>
        <Button onClick={handleSubmit} loading={turnSubmitting}>
          Submit Turn
        </Button>
      </div>
    </div>
  );
}
