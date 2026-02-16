import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/game-store';
import { appTheme } from '../../theme/theme';
import { useAuthStore } from '../../stores/auth-store';
import { GameCard } from './GameCard';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';

export function GameLobby() {
  const { games, gamesLoading, fetchGames, error } = useGameStore();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  return (
    <div className={appTheme.pageShell}>
      <div className={appTheme.pageBackground} aria-hidden />
      <div className={appTheme.pageGrid} aria-hidden />
      <div className={appTheme.pageContent}>
        <header className={`${appTheme.pageHeader} px-6 py-4`}>
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-main">FaxHistoria</h1>
              <p className="text-sm text-text-secondary">
                Welcome, {user?.displayName ?? 'Commander'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => navigate('/game/new/select-country')}>
                New Game
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-main">Your Games</h2>
            <span className="text-xs text-text-secondary">
              {games.length} campaign{games.length === 1 ? '' : 's'}
            </span>
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-danger/35 bg-danger/10 px-4 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {gamesLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : games.length === 0 ? (
            <div className={`${appTheme.panel} p-12 text-center`}>
              <p className="mb-4 text-text-secondary">
                No games yet. Start rewriting history!
              </p>
              <Button onClick={() => navigate('/game/new/select-country')}>
                Create Your First Game
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => (
                <GameCard key={game.id} {...game} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
