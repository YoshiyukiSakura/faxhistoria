import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/i18n-context';
import { SUPPORTED_LANGUAGES } from '../../i18n/messages';
import { useAuthStore } from '../../stores/auth-store';

export function HomePage() {
  const navigate = useNavigate();
  const { language, setLanguage, text } = useI18n();
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  const loginAsGuest = useAuthStore((s) => s.loginAsGuest);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const home = text.home;
  const languageNames = text.common.languageNames;

  if (token) {
    return <Navigate to="/lobby" replace />;
  }

  const handleGuestPlay = async () => {
    await loginAsGuest();
    if (useAuthStore.getState().token) {
      navigate('/lobby');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#03040a] text-text-main">
      <div className="home-bg" aria-hidden />
      <div className="home-stars" aria-hidden />
      <div className="home-noise" aria-hidden />
      <div className="home-horizon" aria-hidden />

      <header className="relative z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10">
          <Link
            to="/"
            className="home-brand text-lg font-semibold tracking-[0.08em] text-slate-100"
          >
            {home.brand}
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="inline-flex items-center rounded-full border border-white/15 bg-black/20 p-1"
              aria-label={home.languageSwitchLabel}
              role="group"
            >
              {SUPPORTED_LANGUAGES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={language === option}
                  onClick={() => setLanguage(option)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.04em] transition-all sm:px-3 ${
                    language === option
                      ? 'bg-cyan-300/25 text-cyan-100'
                      : 'text-slate-300 hover:bg-white/10 hover:text-slate-100'
                  }`}
                >
                  {languageNames[option]}
                </button>
              ))}
            </div>
            <Link
              to="/login"
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-white/45 hover:bg-white/10"
            >
              {home.topSignIn}
            </Link>
            <Link
              to="/register"
              className="rounded-full border border-cyan-300/40 bg-cyan-300/20 px-4 py-2 text-sm font-medium text-cyan-100 transition-all hover:-translate-y-0.5 hover:bg-cyan-300/30"
            >
              {home.topStartFree}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-20 mx-auto max-w-6xl px-6 pb-24 md:px-10 lg:pb-28">
        <section className="grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
          <div className="home-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {home.badge}
              <span className="rounded-full bg-amber-200/90 px-2 py-0.5 text-[10px] font-bold tracking-normal text-slate-900">
                {home.alpha}
              </span>
            </p>

            <h1 className="home-title mt-6 max-w-3xl text-4xl font-bold leading-[1.03] text-slate-50 sm:text-5xl lg:text-6xl">
              {home.title}
            </h1>
            <p className="home-title mt-4 max-w-3xl text-xl font-medium leading-tight text-slate-100/90 sm:text-2xl">
              {home.subtitle}
            </p>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              {home.description}
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGuestPlay}
                disabled={loading}
                className="home-cta-primary inline-flex cursor-pointer items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-slate-50 transition-all disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
                )}
                <span>{loading ? home.ctaGuestLoading : home.ctaGuest}</span>
                {!loading && <span aria-hidden>→</span>}
              </button>

              <Link
                to="/register"
                className="rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition-all hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/10"
              >
                {home.ctaCreateAccount}
              </Link>

              <Link
                to="/login"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-slate-200 transition-all hover:border-cyan-200/50 hover:bg-cyan-200/10"
              >
                {home.ctaExistingAccount}
              </Link>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
                <button
                  type="button"
                  onClick={clearError}
                  className="ml-2 cursor-pointer underline underline-offset-2"
                >
                  {home.errorDismiss}
                </button>
              </div>
            )}

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {home.featureCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-2xl border border-white/12 bg-white/[0.03] p-4 backdrop-blur-sm"
                >
                  <h2 className="text-base font-semibold text-slate-100">
                    {card.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {card.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="home-fade-up-delayed">
            <div className="home-panel rounded-3xl border border-white/15 bg-[#091121]/65 p-6 shadow-2xl backdrop-blur-md sm:p-7">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/90">
                  {home.worldPulse}
                </p>
                <span className="rounded-full border border-amber-200/35 bg-amber-300/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                  {home.liveSimulation}
                </span>
              </div>

              <h2 className="home-title mt-4 text-2xl font-semibold leading-tight text-slate-50 sm:text-3xl">
                {home.panelTitle}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                {home.panelDescription}
              </p>

              <div className="mt-6 grid gap-3">
                {home.signals.map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-100">{signal.label}</span>
                      <span className="text-slate-300">{signal.value}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-sky-300 to-amber-200"
                        style={{ width: `${signal.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/12 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">
                  {home.snapshotTitle}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {home.snapshotStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg bg-white/5 px-3 py-2 text-center"
                    >
                      <p className="text-lg font-semibold text-cyan-100">
                        {stat.value}
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
