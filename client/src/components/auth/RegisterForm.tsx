import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { Button } from '../common/Button';

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { register, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await register(email, password, displayName);
    if (useAuthStore.getState().token) {
      navigate('/lobby');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface border border-border p-8">
        <h1 className="mb-2 text-2xl font-bold text-text-main">Create Account</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Join the world of alternate history
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
            <label className="mb-1 block text-sm text-text-secondary">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={50}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text-main outline-none focus:border-primary"
            />
          </div>

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
            <label className="mb-1 block text-sm text-text-secondary">
              Password (min 6 chars)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text-main outline-none focus:border-primary"
            />
          </div>

          <Button type="submit" loading={loading}>
            Create Account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
