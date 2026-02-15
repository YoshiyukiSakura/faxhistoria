import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminStatsResponse } from '@faxhistoria/shared';
import { api, ApiError } from '../../services/api';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { useAuthStore } from '../../stores/auth-store';

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function AdminPanel() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load admin stats';
      setError(message);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-text-main">Admin Panel</h1>
          <p className="text-sm text-text-secondary">
            Signed in as {user?.displayName ?? user?.email ?? 'Admin'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/lobby')}>
            Back to Lobby
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

      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-main">Platform Statistics</h2>
          <Button variant="secondary" loading={refreshing} onClick={() => fetchStats(true)}>
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : stats ? (
          <>
            <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <article className="rounded-xl border border-border bg-surface p-5">
                <p className="text-xs uppercase tracking-wide text-text-secondary">Total Players</p>
                <p className="mt-2 text-3xl font-bold text-text-main">
                  {formatNumber(stats.playerCount)}
                </p>
              </article>
              <article className="rounded-xl border border-border bg-surface p-5">
                <p className="text-xs uppercase tracking-wide text-text-secondary">Active Players</p>
                <p className="mt-2 text-3xl font-bold text-text-main">
                  {formatNumber(stats.activePlayerCount)}
                </p>
              </article>
            </section>

            <section className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-4 text-base font-semibold text-text-main">Token Usage</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Prompt Tokens" value={stats.tokenUsage.promptTokens} />
                <StatCard label="Output Tokens" value={stats.tokenUsage.outputTokens} />
                <StatCard label="Total Tokens" value={stats.tokenUsage.totalTokens} />
                <StatCard label="Model Runs" value={stats.tokenUsage.totalModelRuns} />
                <StatCard label="Successful Runs" value={stats.tokenUsage.successfulModelRuns} />
                <StatCard label="Failed Runs" value={stats.tokenUsage.failedModelRuns} />
              </div>
            </section>

            <p className="mt-4 text-xs text-text-secondary">
              Last updated: {new Date(stats.generatedAt).toLocaleString()}
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-border bg-bg p-4">
      <p className="text-xs uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-main">{formatNumber(value)}</p>
    </article>
  );
}
