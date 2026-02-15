import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/game-store';
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
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-text-main">Faxhistoria</h1>
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
      </header>

      <main className="mx-auto max-w-4xl p-6">
        <h2 className="mb-4 text-lg font-semibold text-text-main">Your Games</h2>

        {error && (
          <p className="mb-4 text-sm text-danger">{error}</p>
        )}

        {gamesLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center">
            <p className="text-text-secondary mb-4">
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
  );
}
