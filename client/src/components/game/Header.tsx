import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/game-store';
import { appTheme } from '../../theme/theme';
import { Button } from '../common/Button';

export function Header() {
  const gameState = useGameStore((s) => s.gameState);
  const gameTurns = useGameStore((s) => s.gameTurns);
  const viewedTurnNumber = useGameStore((s) => s.viewedTurnNumber);
  const jumpToCurrentTurn = useGameStore((s) => s.jumpToCurrentTurn);
  const navigate = useNavigate();

  if (!gameState) return null;

  const playerCountry = gameState.countries[gameState.playerCountry];
  const activeTurn = viewedTurnNumber ?? gameState.turnNumber;
  const viewingHistory = activeTurn < gameState.turnNumber;
  const activeTurnRecord = gameTurns.find((turn) => turn.turnNumber === activeTurn);
  const activeYear =
    activeTurnRecord?.year ?? gameState.currentYear - (gameState.turnNumber - activeTurn);

  return (
    <header className={`${appTheme.pageHeader} px-4 py-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
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

        {viewingHistory ? (
          <Button
            variant="secondary"
            className="px-3 py-1 text-xs"
            onClick={jumpToCurrentTurn}
          >
            Current Turn
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:mt-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-6">
        <div className="text-text-secondary">
          Year <span className="font-semibold text-text-main">{activeYear}</span>
        </div>
        <div className="text-text-secondary">
          Turn <span className="font-semibold text-text-main">{activeTurn}</span>
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
              GDP <span className="font-semibold text-text-main">${playerCountry.gdp}B</span>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
