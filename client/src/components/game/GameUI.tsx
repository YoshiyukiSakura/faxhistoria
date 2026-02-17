import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '../../stores/game-store';
import { useUIStore } from '../../stores/ui-store';
import { Header } from './Header';
import { WorldMap } from './WorldMap';
import { ActionPanel } from './ActionPanel';
import { EventLog } from './EventLog';
import { CountryStatsPanel } from './CountryStatsPanel';
import { TurnTimelinePanel } from './TurnTimelinePanel';
import { Spinner } from '../common/Spinner';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { GameOnboardingModal } from './GameOnboardingModal';
import { appTheme } from '../../theme/theme';

export function GameUI() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWorldNarrativeModal, setShowWorldNarrativeModal] = useState(false);
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const actionSectionRef = useRef<HTMLDivElement>(null);
  const historySectionRef = useRef<HTMLDivElement>(null);
  const worldSectionRef = useRef<HTMLDivElement>(null);
  const selectedCountry = useUIStore((s) => s.selectedCountry);
  const selectCountry = useUIStore((s) => s.selectCountry);
  const {
    loadGame,
    gameState,
    gameTurns,
    viewedTurnNumber,
    setViewedTurnNumber,
    jumpToCurrentTurn,
    gameLoading,
    error,
    clearCurrentGame,
  } = useGameStore();
  const roundParam = searchParams.get('round');
  const onboardingStorageKey = useMemo(
    () => (id ? `faxhistoria:onboarding-dismissed:${id}` : null),
    [id],
  );

  const scrollToSection = useCallback((section: 'map' | 'action' | 'history' | 'world') => {
    const sectionMap = {
      map: mapSectionRef,
      action: actionSectionRef,
      history: historySectionRef,
      world: worldSectionRef,
    };
    sectionMap[section].current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  useEffect(() => {
    selectCountry(null);
    if (id) {
      loadGame(id);
    }
    return () => {
      clearCurrentGame();
      selectCountry(null);
    };
  }, [id, loadGame, clearCurrentGame, selectCountry]);

  useEffect(() => {
    if (!gameState) return;

    const availableTurns = new Set([
      0,
      gameState.turnNumber,
      ...gameTurns.map((turn) => turn.turnNumber),
    ]);
    const parsedRound = roundParam === null ? null : Number.parseInt(roundParam, 10);

    if (
      parsedRound !== null &&
      Number.isInteger(parsedRound) &&
      availableTurns.has(parsedRound)
    ) {
      if (viewedTurnNumber !== parsedRound) {
        setViewedTurnNumber(parsedRound);
      }
      return;
    }

    if (roundParam === null) {
      setViewedTurnNumber(gameState.turnNumber);
    }
  }, [gameState, gameTurns, roundParam, setViewedTurnNumber]);

  useEffect(() => {
    if (!gameState || !onboardingStorageKey) return;
    const dismissed = window.localStorage.getItem(onboardingStorageKey) === '1';
    setShowOnboarding(!dismissed && gameState.turnNumber <= 1);
  }, [gameState, onboardingStorageKey]);

  useEffect(() => {
    if (!gameState || viewedTurnNumber === null) return;

    const nextParams = new URLSearchParams(searchParams);
    if (viewedTurnNumber === gameState.turnNumber) {
      nextParams.delete('round');
    } else {
      nextParams.set('round', String(viewedTurnNumber));
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [gameState, viewedTurnNumber, searchParams, setSearchParams]);

  if (gameLoading && !gameState) {
    return (
      <div className={`${appTheme.pageShell} flex h-screen items-center justify-center`}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !gameState) {
    return (
      <div className={`${appTheme.pageShell} flex h-screen flex-col items-center justify-center gap-4`}>
        <p className="text-danger">{error}</p>
        <button
          onClick={() => navigate('/lobby')}
          className="cursor-pointer text-primary hover:underline"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  if (!gameState) return null;

  const activeTurn = viewedTurnNumber ?? gameState.turnNumber;
  const viewingHistory = activeTurn < gameState.turnNumber;
  const turnGap = gameState.turnNumber - activeTurn;
  const worldNarrative =
    gameState.worldNarrative ??
    'No global narrative has been generated yet. Submit a turn to grow the world context.';
  const compactWorldNarrative = worldNarrative.replace(/\s+/g, ' ').trim();
  const worldNarrativeSummary =
    compactWorldNarrative.length > 158
      ? `${compactWorldNarrative.slice(0, 158).trimEnd()}...`
      : compactWorldNarrative;
  const handleOnboardingClose = (hideForever: boolean) => {
    if (hideForever && onboardingStorageKey) {
      window.localStorage.setItem(onboardingStorageKey, '1');
    }
    setShowOnboarding(false);
  };

  return (
    <div className={appTheme.pageShell}>
      <div className={appTheme.pageBackground} aria-hidden />
      <div className={appTheme.pageGrid} aria-hidden />
      <div className={`${appTheme.pageContent} flex h-screen flex-col`}>
        <Header />
        {viewingHistory ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-surface/78 px-4 py-2">
            <p className="text-sm text-text-secondary">
              Viewing turn {activeTurn} ({turnGap} turn{turnGap === 1 ? '' : 's'} behind
              current). Return to current turn to submit a new action.
            </p>
            <Button
              variant="secondary"
              className="px-3 py-1 text-xs"
              onClick={jumpToCurrentTurn}
            >
              Go to Current Turn
            </Button>
          </div>
        ) : null}
        <main className="flex-1 min-h-0 overflow-y-auto px-3 py-3 sm:px-4 xl:overflow-hidden">
          <div className="mx-auto flex w-full max-w-[1840px] flex-col gap-3 xl:h-full xl:min-h-0">
            <div className="app-panel p-2 xl:hidden">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Button
                  variant="secondary"
                  className="px-2 py-1 text-[11px]"
                  onClick={() => scrollToSection('map')}
                >
                  Map
                </Button>
                <Button
                  variant="secondary"
                  className="px-2 py-1 text-[11px]"
                  onClick={() => scrollToSection('action')}
                >
                  Action
                </Button>
                <Button
                  variant="secondary"
                  className="px-2 py-1 text-[11px]"
                  onClick={() => scrollToSection('history')}
                >
                  History
                </Button>
                <Button
                  variant="secondary"
                  className="px-2 py-1 text-[11px]"
                  onClick={() => scrollToSection('world')}
                >
                  World
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <p className="text-[11px] text-text-secondary">
                  Workflow dock: jump to the section you need.
                </p>
                <button
                  type="button"
                  onClick={() => setShowOnboarding(true)}
                  className="cursor-pointer text-[11px] font-medium text-primary hover:underline"
                >
                  Guide
                </button>
              </div>
            </div>

            <div className="hidden items-center justify-end xl:flex">
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="cursor-pointer px-1 text-xs font-medium text-primary hover:underline"
              >
                Guide
              </button>
            </div>

            <div className="grid gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(19rem,0.92fr)_minmax(0,2fr)_minmax(20rem,0.9fr)]">
              <div
                ref={mapSectionRef}
                className="order-1 app-panel min-h-[320px] overflow-hidden sm:min-h-[420px] xl:order-2 xl:h-full xl:min-h-0"
              >
                <WorldMap />
              </div>

              <aside className="order-2 flex min-h-0 flex-col gap-3 xl:order-1 xl:h-full xl:overflow-y-auto xl:pr-1">
                <div className="min-h-[250px] xl:min-h-0 xl:flex-[0.95]">
                  <TurnTimelinePanel />
                </div>
                <div ref={actionSectionRef} className="min-h-[320px] xl:min-h-0 xl:flex-[1.35]">
                  <ActionPanel />
                </div>
              </aside>

              <aside
                ref={historySectionRef}
                className="order-3 flex min-h-0 flex-col gap-3 xl:h-full xl:overflow-visible xl:pl-1"
              >
                <div className="min-h-[340px] xl:min-h-0 xl:flex-1">
                  <EventLog />
                </div>

                <div ref={worldSectionRef} className="xl:sticky xl:bottom-2">
                  <button
                    type="button"
                    onClick={() => setShowWorldNarrativeModal(true)}
                    className="app-panel-soft w-full cursor-pointer p-3 text-left transition hover:border-primary/55"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-main">
                        World Brief
                      </h3>
                      <span className="text-[11px] text-primary">Details</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                      {worldNarrativeSummary}
                    </p>
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>
      <Modal
        open={Boolean(selectedCountry)}
        onClose={() => selectCountry(null)}
        title={selectedCountry ? `${selectedCountry} Intel` : 'Country Intel'}
      >
        <CountryStatsPanel />
      </Modal>
      <Modal
        open={showWorldNarrativeModal}
        onClose={() => setShowWorldNarrativeModal(false)}
        title="World Situation"
      >
        <div className="max-h-[66vh] overflow-y-auto pr-1">
          <p className="text-sm leading-relaxed text-text-secondary">{worldNarrative}</p>
        </div>
      </Modal>
      <GameOnboardingModal open={showOnboarding} onClose={handleOnboardingClose} />
    </div>
  );
}
