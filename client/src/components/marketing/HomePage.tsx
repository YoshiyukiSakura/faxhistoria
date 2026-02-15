import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

export function HomePage() {
  const token = useAuthStore((s) => s.token);

  if (token) {
    return <Navigate to="/lobby" replace />;
  }

  return (
    <div className="min-h-screen bg-bg text-text-main">
      <header className="border-b border-border bg-surface/50 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <p className="text-lg font-bold tracking-wide">FaxHistoria</p>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-main transition-colors hover:bg-surface"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-20">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.16em] text-primary">
            AI Historical Sandbox
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Rewrite world history one strategic turn at a time.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            FaxHistoria is an AI-driven strategy simulation where you guide a
            country through diplomacy, economy, military conflict, and global
            crisis response. Every turn changes the world state in persistent,
            explainable ways.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="rounded-lg bg-primary px-5 py-3 font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Create Account
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-border px-5 py-3 font-medium text-text-main transition-colors hover:bg-surface"
            >
              I already have an account
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-3">
          <article className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">AI Turn Resolution</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Submit national actions and receive structured world events shaped
              by AI plus deterministic game rules.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">Persistent Game State</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Economy, public stability, diplomacy, and military metrics evolve
              turn by turn and carry over through your campaign.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">Fast Browser Gameplay</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Play directly in the browser with real-time turn streaming,
              country dashboards, and event timelines.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
