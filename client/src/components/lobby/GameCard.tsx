import { useNavigate } from 'react-router-dom';
import { INITIAL_COUNTRIES } from '@faxhistoria/shared';

interface GameCardProps {
  id: string;
  name: string;
  playerCountry: string;
  currentYear: number;
  turnNumber: number;
}

export function GameCard({
  id,
  name,
  playerCountry,
  currentYear,
  turnNumber,
}: GameCardProps) {
  const navigate = useNavigate();
  const countryData = INITIAL_COUNTRIES[playerCountry];

  return (
    <div
      onClick={() => navigate(`/game/${id}`)}
      className="cursor-pointer rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-hover"
    >
      <h3 className="mb-2 text-lg font-semibold text-text-main">{name}</h3>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: countryData?.color ?? '#9CA3AF' }}
        />
        <span className="text-sm text-text-secondary">{playerCountry}</span>
      </div>
      <div className="flex gap-4 text-xs text-text-secondary">
        <span>Year {currentYear}</span>
        <span>Turn {turnNumber}</span>
      </div>
    </div>
  );
}
