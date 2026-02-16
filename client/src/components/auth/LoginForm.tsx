import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { appTheme } from '../../theme/theme';
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
    <div className={appTheme.pageShell}>
      <div className={appTheme.pageBackground} aria-hidden />
      <div className={appTheme.pageGrid} aria-hidden />
      <div className={`${appTheme.pageContent} flex min-h-screen items-center justify-center px-4 py-10`}>
        <div className={`${appTheme.panel} w-full max-w-sm p-8`}>
          <h1 className="mb-2 text-2xl font-bold text-text-main">FaxHistoria</h1>
          <p className="mb-6 text-sm text-text-secondary">
            AI-driven alternate history strategy
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">
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
                className={appTheme.input}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-secondary">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={appTheme.input}
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
    </div>
  );
}
