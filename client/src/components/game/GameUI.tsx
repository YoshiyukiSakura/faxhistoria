import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '../../stores/game-store';
import { Header } from './Header';
import { WorldMap } from './WorldMap';
import { ActionPanel } from './ActionPanel';
import { EventLog } from './EventLog';
import { CountryStatsPanel } from './CountryStatsPanel';
import { TurnTimelinePanel } from './TurnTimelinePanel';
import { Spinner } from '../common/Spinner';
import { Button } from '../common/Button';
import { GameOnboardingModal } from './GameOnboardingModal';
import { appTheme } from '../../theme/theme';

export function GameUI() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const actionSectionRef = useRef<HTMLDivElement>(null);
  const historySectionRef = useRef<HTMLDivElement>(null);
  const intelSectionRef = useRef<HTMLDivElement>(null);
  const worldSectionRef = useRef<HTMLDivElement>(null);
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

  const scrollToSection = useCallback((section: 'action' | 'history' | 'intel' | 'world') => {
    const sectionMap = {
      action: actionSectionRef,
      history: historySectionRef,
      intel: intelSectionRef,
      world: worldSectionRef,
    };
    sectionMap[section].current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  useEffect(() => {
    if (id) {
      loadGame(id);
    }
    return () => {
      clearCurrentGame();
    };
  }, [id, loadGame, clearCurrentGame]);

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
        <main className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3">
            <div className="app-panel sticky top-3 z-20 p-2">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
                  onClick={() => scrollToSection('intel')}
                >
                  Intel
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

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(22rem,1fr)]">
              <div className="app-panel h-[42vh] min-h-[320px] overflow-hidden sm:h-[46vh] xl:h-[62vh] xl:max-h-[640px]">
                <WorldMap />
              </div>
              <div ref={actionSectionRef}>
                <ActionPanel />
              </div>
            </div>

            <div ref={historySectionRef} className="grid gap-3 xl:grid-cols-2">
              <TurnTimelinePanel />
              <EventLog />
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <div ref={intelSectionRef}>
                <CountryStatsPanel />
              </div>

              <div ref={worldSectionRef} className="app-panel p-4">
                <h3 className="mb-2 text-sm font-semibold text-text-main">World Situation</h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {gameState.worldNarrative ??
                    'No global narrative has been generated yet. Submit a turn to grow the world context.'}
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
      <GameOnboardingModal open={showOnboarding} onClose={handleOnboardingClose} />
    </div>
  );
}
