import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface GameOnboardingModalProps {
  open: boolean;
  onClose: (hideForever: boolean) => void;
}

interface OnboardingStep {
  title: string;
  description: string;
  tag: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Explore The Map',
    description: 'Drag, zoom, and inspect neighboring powers before deciding your next move.',
    tag: 'MAP',
  },
  {
    title: 'Read The Timeline',
    description: 'Jump across turns and key moments to understand cause-and-effect quickly.',
    tag: 'TIME',
  },
  {
    title: 'Issue A Clear Action',
    description: 'Write one concrete policy objective so AI can produce higher-quality events.',
    tag: 'ACT',
  },
  {
    title: 'Monitor Live Resolution',
    description: 'Follow AI drafting and final events in real time before planning your next turn.',
    tag: 'LIVE',
  },
];

export function GameOnboardingModal({ open, onClose }: GameOnboardingModalProps) {
  const [hideForever, setHideForever] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHideForever(false);
  }, [open]);

  return (
    <Modal open={open} onClose={() => onClose(hideForever)} title="Welcome Commander">
      <p className="mb-4 text-sm leading-relaxed text-text-secondary">
        Build momentum in each turn by following this loop:
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {ONBOARDING_STEPS.map((step) => (
          <div
            key={step.title}
            className="app-panel-soft px-3 py-3"
          >
            <p className="mb-1 text-sm font-semibold text-text-main">
              <span className="mr-2 rounded bg-surface/75 px-1.5 py-0.5 text-[10px] tracking-wide text-text-secondary">
                {step.tag}
              </span>
              {step.title}
            </p>
            <p className="text-xs leading-relaxed text-text-secondary">
              {step.description}
            </p>
          </div>
        ))}
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={hideForever}
          onChange={(event) => setHideForever(event.target.checked)}
          className="h-4 w-4 rounded border-border bg-bg/70 text-primary"
        />
        Don&apos;t show this guide again for this campaign
      </label>

      <div className="mt-5 flex justify-end">
        <Button onClick={() => onClose(hideForever)}>Start Campaign</Button>
      </div>
    </Modal>
  );
}
