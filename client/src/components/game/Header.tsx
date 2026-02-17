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
    <header className={`${appTheme.pageHeader} px-3 py-2 sm:px-4 sm:py-1.5`}>
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            variant="secondary"
            className="px-2 py-0.5 text-[11px]"
            onClick={() => navigate('/lobby')}
          >
            Lobby
          </Button>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: playerCountry?.color ?? '#9CA3AF' }}
            />
            <span className="text-sm font-semibold text-text-main">
              {playerCountry?.displayName ?? gameState.playerCountry}
            </span>
          </div>
        </div>

        {viewingHistory ? (
          <Button
            variant="secondary"
            className="px-2.5 py-0.5 text-[11px]"
            onClick={jumpToCurrentTurn}
          >
            Current Turn
          </Button>
        ) : null}
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs sm:mt-1 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-4">
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
