import { create } from 'zustand';
import { api, ApiError } from '../services/api';
import type { GameState, TurnProgressEvent, TurnResponse } from '@faxhistoria/shared';

type LiveTurnEvent = NonNullable<TurnProgressEvent['liveEvent']>;
type LiveDraftEvent = NonNullable<TurnProgressEvent['liveDraftEvent']>;
type PersistedTurnEventData = {
  type?: string;
  description?: string;
  involvedCountries?: string[];
};

export interface GameTurnEvent {
  id: string;
  eventType: string;
  eventData: PersistedTurnEventData;
  sequence: number;
  createdAt: string;
}

export interface GameTurnSummary {
  id: string;
  turnNumber: number;
  year: number;
  playerAction: string;
  createdAt: string;
  events: GameTurnEvent[];
}

interface GameDetailResponse {
  id: string;
  turnNumber: number;
  currentYear: number;
  currentState: GameState;
  turns: GameTurnSummary[];
}

interface GameSummary {
  id: string;
  name: string;
  playerCountry: string;
  currentYear: number;
  turnNumber: number;
  createdAt: string;
}

interface GameStoreState {
  // Game list
  games: GameSummary[];
  gamesLoading: boolean;

  // Current game
  currentGameId: string | null;
  gameState: GameState | null;
  gameTurns: GameTurnSummary[];
  viewedTurnNumber: number | null;
  gameLoading: boolean;

  // Turn
  turnSubmitting: boolean;
  turnProgress: TurnProgressEvent | null;
  turnLiveEvents: LiveTurnEvent[];
  turnDraftEvents: LiveDraftEvent[];
  lastTurnResponse: TurnResponse | null;

  error: string | null;

  // Actions
  fetchGames: () => Promise<void>;
  createGame: (name: string, playerCountry: string, startYear?: number) => Promise<string | null>;
  loadGame: (gameId: string) => Promise<void>;
  submitTurn: (action: string) => Promise<TurnResponse | null>;
  setViewedTurnNumber: (turnNumber: number) => void;
  jumpToCurrentTurn: () => void;
  clearTurnProgress: () => void;
  clearError: () => void;
  clearCurrentGame: () => void;
}

export const useGameStore = create<GameStoreState>()((set, get) => ({
  games: [],
  gamesLoading: false,
  currentGameId: null,
  gameState: null,
  gameTurns: [],
  viewedTurnNumber: null,
  gameLoading: false,
  turnSubmitting: false,
  turnProgress: null,
  turnLiveEvents: [],
  turnDraftEvents: [],
  lastTurnResponse: null,
  error: null,

  fetchGames: async () => {
    set({ gamesLoading: true, error: null });
    try {
      const games = await api.get<GameSummary[]>('/games');
      set({ games, gamesLoading: false });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch games';
      set({ gamesLoading: false, error: message });
    }
  },

  createGame: async (name, playerCountry, startYear = 2024) => {
    set({ gameLoading: true, error: null });
    try {
      const data = await api.post<{ id: string }>('/games', {
        name,
        playerCountry,
        startYear,
      });
      set({ gameLoading: false });
      return data.id;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create game';
      set({ gameLoading: false, error: message });
      return null;
    }
  },

  loadGame: async (gameId) => {
    set({ gameLoading: true, error: null, currentGameId: gameId });
    try {
      const data = await api.get<GameDetailResponse>(`/games/${gameId}`);
      const sortedTurns = [...(data.turns ?? [])].sort(
        (a, b) => b.turnNumber - a.turnNumber,
      );
      set({
        gameState: data.currentState as GameState,
        gameTurns: sortedTurns,
        viewedTurnNumber: data.currentState.turnNumber,
        gameLoading: false,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load game';
      set({ gameLoading: false, error: message });
    }
  },

  submitTurn: async (action) => {
    const { currentGameId, gameState } = get();
    if (!currentGameId || !gameState) return null;

    const idempotencyKey = crypto.randomUUID();
    set({
      turnSubmitting: true,
      error: null,
      turnLiveEvents: [],
      turnDraftEvents: [],
      turnProgress: {
        stage: 'VALIDATING',
        progress: 0,
        message: 'Preparing turn request',
        timestamp: new Date().toISOString(),
      },
    });

    try {
      const data = await api.postTurnWithProgress(
        `/games/${currentGameId}/turn/stream`,
        {
          action,
          expectedTurnNumber: gameState.turnNumber,
        },
        idempotencyKey,
        (progress) => {
          set((state) => {
            const shouldResetDrafts =
              progress.stage === 'AI_RETRY' && (progress.attempt ?? 1) > 1;
            let nextDraftEvents = shouldResetDrafts ? [] : state.turnDraftEvents;
            if (progress.liveDraftEvent) {
              const draftEvent = progress.liveDraftEvent;
              const idx = nextDraftEvents.findIndex((event) => event.id === draftEvent.id);
              if (idx >= 0) {
                nextDraftEvents = [
                  ...nextDraftEvents.slice(0, idx),
                  draftEvent,
                  ...nextDraftEvents.slice(idx + 1),
                ];
              } else {
                nextDraftEvents = [...nextDraftEvents, draftEvent];
              }
            }

            const liveEvent = progress.liveEvent;
            let nextLiveEvents = state.turnLiveEvents;
            if (!liveEvent) {
              return {
                turnProgress: progress,
                turnDraftEvents: nextDraftEvents,
              };
            }
            if (state.turnLiveEvents.some((event) => event.id === liveEvent.id)) {
              return {
                turnProgress: progress,
                turnDraftEvents: nextDraftEvents,
              };
            }
            nextLiveEvents = [...state.turnLiveEvents, liveEvent];
            return {
              turnProgress: progress,
              turnLiveEvents: nextLiveEvents,
              turnDraftEvents: nextDraftEvents,
            };
          });
        },
      );
      set({ lastTurnResponse: data });
      // Reload game state
      await get().loadGame(currentGameId);
      set({ turnSubmitting: false });
      return data;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to submit turn';
      set({
        turnSubmitting: false,
        error: message,
        turnProgress: {
          stage: 'FAILED',
          progress: 100,
          message,
          timestamp: new Date().toISOString(),
          error: {
            message,
            statusCode: err instanceof ApiError ? err.statusCode : 500,
          },
        },
      });
      return null;
    }
  },

  setViewedTurnNumber: (turnNumber) =>
    set((state) => {
      const currentTurn = state.gameState?.turnNumber;
      if (currentTurn === undefined) return {};
      const availableTurns = new Set([
        0,
        currentTurn,
        ...state.gameTurns.map((turn) => turn.turnNumber),
      ]);
      if (!availableTurns.has(turnNumber)) return {};
      return { viewedTurnNumber: turnNumber };
    }),

  jumpToCurrentTurn: () =>
    set((state) => {
      if (!state.gameState) return {};
      return { viewedTurnNumber: state.gameState.turnNumber };
    }),

  clearTurnProgress: () => set({ turnProgress: null, turnLiveEvents: [], turnDraftEvents: [] }),
  clearError: () => set({ error: null }),
  clearCurrentGame: () =>
    set({
      currentGameId: null,
      gameState: null,
      gameTurns: [],
      viewedTurnNumber: null,
      lastTurnResponse: null,
      turnProgress: null,
      turnLiveEvents: [],
      turnDraftEvents: [],
    }),
}));
