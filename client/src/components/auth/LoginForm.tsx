import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { Button } from '../common/Button';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loginAsGuest, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await login(email, password);
    if (useAuthStore.getState().token) {
      navigate('/lobby');
    }
  };

  const handleGuestLogin = async () => {
    await loginAsGuest();
    if (useAuthStore.getState().token) {
      navigate('/lobby');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface border border-border p-8">
        <h1 className="mb-2 text-2xl font-bold text-text-main">Faxhistoria</h1>
        <p className="mb-6 text-sm text-text-secondary">
          AI-driven alternate history strategy
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
              <button
                type="button"
                onClick={clearError}
                className="ml-2 cursor-pointer underline"
              >
                dismiss
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-text-secondary">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text-main outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text-main outline-none focus:border-primary"
            />
          </div>

          <Button type="submit" loading={loading}>
            Sign In
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={handleGuestLogin}
          >
            Continue as Guest
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          No account?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
