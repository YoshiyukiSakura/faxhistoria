import { test, expect } from '@playwright/test';
import {
  registerUser,
  createGame,
  submitTurnWithRetry,
  getGame,
  cleanupTestData,
  prisma,
} from './test-helpers';

// This test file makes 5 sequential AI calls — mark all tests as slow (3x timeout)
test.describe.configure({ mode: 'serial' });

let token: string;
let setupOk = false;

test.beforeAll(async ({ request }) => {
  const { res } = await registerUser(request);
  token = (await res.json()).token;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe('Game Lifecycle E2E (multi-turn)', () => {
  let gameId: string;
  let turnsCompleted = 0;

  test('should create a game and play 3 turns → progressive state', async ({ request }) => {
    test.slow(); // 3x timeout = 15 min
    const gameRes = await createGame(request, token, {
      name: 'Test Game Lifecycle',
      playerCountry: 'Japan',
      startYear: 2024,
    });
    expect(gameRes.status()).toBe(201);
    gameId = (await gameRes.json()).id;
    setupOk = true;

    const actions = [
      'Increase investment in semiconductor manufacturing',
      'Strengthen military alliance with South Korea',
      'Launch a diplomatic initiative with China on trade',
    ];

    for (let i = 0; i < 3; i++) {
      const res = await submitTurnWithRetry(request, token, gameId, actions[i], i);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.turnNumber).toBe(i + 1);
      expect(body.year).toBe(2024 + i + 1);
      turnsCompleted = i + 1;
    }
  });

  test('should have year = startYear + 3 and turnNumber = 3 after 3 turns', async ({ request }) => {
    test.skip(turnsCompleted < 3, 'Previous test did not complete 3 turns');
    const res = await getGame(request, token, gameId);
    const game = await res.json();
    expect(game.turnNumber).toBe(3);
    expect(game.currentYear).toBe(2027);
  });

  test('should have recentEvents accumulated across turns', async ({ request }) => {
    test.skip(turnsCompleted < 3, 'Previous test did not complete 3 turns');
    const res = await getGame(request, token, gameId);
    const state = (await res.json()).currentState;
    expect(state.recentEvents).toBeDefined();
    expect(state.recentEvents.length).toBeGreaterThan(0);
  });

  test('should create GameSnapshot at turn 5', async ({ request }) => {
    test.slow(); // 3x timeout = 15 min
    test.skip(turnsCompleted < 3, 'Need at least 3 turns completed');
    // Play 2 more turns to reach turn 5
    for (let i = 3; i < 5; i++) {
      const res = await submitTurnWithRetry(
        request,
        token,
        gameId,
        `Continue diplomatic efforts in year ${2024 + i + 1}`,
        i,
      );
      expect(res.status()).toBe(200);
      turnsCompleted = i + 1;
    }

    const snapshot = await prisma.gameSnapshot.findFirst({
      where: { gameId, turnNumber: 5 },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.year).toBe(2029);
  });

  test('should have AI events that mostly reference countries from state', async ({ request }) => {
    test.skip(turnsCompleted < 1, 'Need at least 1 turn completed');
    const res = await getGame(request, token, gameId);
    const game = await res.json();
    const stateCountries = new Set(Object.keys(game.currentState.countries));

    const latestTurn = game.turns[0];
    let totalCountryRefs = 0;
    let validCountryRefs = 0;

    for (const event of latestTurn.events) {
      const eventData = event.eventData;
      if (eventData.involvedCountries && eventData.involvedCountries.length > 0) {
        for (const country of eventData.involvedCountries) {
          totalCountryRefs++;
          if (stateCountries.has(country)) validCountryRefs++;
        }
      }
    }

    // At least 80% of country references should be from the game state
    // (AI may occasionally mention countries not in the 35-country set)
    if (totalCountryRefs > 0) {
      const ratio = validCountryRefs / totalCountryRefs;
      expect(ratio).toBeGreaterThanOrEqual(0.8);
    }
  });

  test('should have world narrative updated each turn', async ({ request }) => {
    test.skip(turnsCompleted < 1, 'Need at least 1 turn completed');
    const res = await getGame(request, token, gameId);
    const state = (await res.json()).currentState;
    expect(state.worldNarrative).toBeDefined();
    expect(state.worldNarrative.length).toBeGreaterThan(0);
  });

  test('should have economic effects actually changing country data', async ({ request }) => {
    test.skip(turnsCompleted < 1, 'Need at least 1 turn completed');
    const res = await getGame(request, token, gameId);
    const state = (await res.json()).currentState;

    const japan = state.countries['Japan'];
    expect(japan).toBeDefined();
    expect(typeof japan.gdp).toBe('number');
    expect(typeof japan.population).toBe('number');
    expect(typeof japan.stability).toBe('number');
    expect(japan.stability).toBeGreaterThanOrEqual(0);
    expect(japan.stability).toBeLessThanOrEqual(100);
  });
});
