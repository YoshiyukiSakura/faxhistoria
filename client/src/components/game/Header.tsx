import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/game-store';
import { Button } from '../common/Button';

export function Header() {
  const gameState = useGameStore((s) => s.gameState);
  const navigate = useNavigate();

  if (!gameState) return null;

  const playerCountry = gameState.countries[gameState.playerCountry];

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          className="text-xs px-2 py-1"
          onClick={() => navigate('/lobby')}
        >
          Lobby
        </Button>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: playerCountry?.color ?? '#9CA3AF' }}
          />
          <span className="font-semibold text-text-main">
            {playerCountry?.displayName ?? gameState.playerCountry}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="text-text-secondary">
          Year{' '}
          <span className="font-semibold text-text-main">
            {gameState.currentYear}
          </span>
        </div>
        <div className="text-text-secondary">
          Turn{' '}
          <span className="font-semibold text-text-main">
            {gameState.turnNumber}
          </span>
        </div>
        {playerCountry && (
          <>
            <div className="text-text-secondary">
              Stability{' '}
              <span className="font-semibold text-text-main">
                {playerCountry.stability}%
              </span>
            </div>
            <div className="text-text-secondary">
              GDP{' '}
              <span className="font-semibold text-text-main">
                ${playerCountry.gdp}B
              </span>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
