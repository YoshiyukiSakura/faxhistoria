import { create } from 'zustand';
import { api, ApiError } from '../services/api';
import type { GameState, TurnProgressEvent, TurnResponse } from '@faxhistoria/shared';

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
  gameLoading: boolean;

  // Turn
  turnSubmitting: boolean;
  turnProgress: TurnProgressEvent | null;
  lastTurnResponse: TurnResponse | null;

  error: string | null;

  // Actions
  fetchGames: () => Promise<void>;
  createGame: (name: string, playerCountry: string, startYear?: number) => Promise<string | null>;
  loadGame: (gameId: string) => Promise<void>;
  submitTurn: (action: string) => Promise<TurnResponse | null>;
  clearTurnProgress: () => void;
  clearError: () => void;
  clearCurrentGame: () => void;
}

export const useGameStore = create<GameStoreState>()((set, get) => ({
  games: [],
  gamesLoading: false,
  currentGameId: null,
  gameState: null,
  gameLoading: false,
  turnSubmitting: false,
  turnProgress: null,
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
      const data = await api.get<{ currentState: GameState }>(`/games/${gameId}`);
      set({ gameState: data.currentState as GameState, gameLoading: false });
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
          set({ turnProgress: progress });
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

  clearTurnProgress: () => set({ turnProgress: null }),
  clearError: () => set({ error: null }),
  clearCurrentGame: () =>
    set({
      currentGameId: null,
      gameState: null,
      lastTurnResponse: null,
      turnProgress: null,
    }),
}));
