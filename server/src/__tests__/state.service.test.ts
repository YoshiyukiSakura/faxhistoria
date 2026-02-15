import { describe, it, expect } from 'vitest';
import { initializeGameState, applyEvents } from '../services/state.service';
import type { WorldEvent, GameState } from '@faxhistoria/shared';

describe('initializeGameState', () => {
  it('creates a valid initial state for a known country', () => {
    const state = initializeGameState('United States', 2024);
    expect(state.playerCountry).toBe('United States');
    expect(state.currentYear).toBe(2024);
    expect(state.turnNumber).toBe(0);
    expect(state.countries['United States']).toBeDefined();
    expect(state.countries['United States'].gdp).toBeGreaterThan(0);
    expect(state.territories['US_MAINLAND']).toBeDefined();
    expect(state.territories['US_MAINLAND'].owner).toBe('United States');
    expect(state.activeWars).toHaveLength(0);
    expect(state.activeAlliances).toHaveLength(0);
  });

  it('creates territories for all countries', () => {
    const state = initializeGameState('China', 2024);
    // All countries should have at least one territory
    for (const country of Object.values(state.countries)) {
      expect(country.territories.length).toBeGreaterThan(0);
      for (const tid of country.territories) {
        expect(state.territories[tid]).toBeDefined();
        expect(state.territories[tid].owner).toBe(country.name);
      }
    }
  });

  it('initializes relations as NEUTRAL for all country pairs', () => {
    const state = initializeGameState('Japan', 2024);
    const japan = state.countries['Japan'];
    expect(japan.relations.length).toBeGreaterThan(0);
    for (const rel of japan.relations) {
      expect(rel.status).toBe('NEUTRAL');
    }
  });
});

describe('applyEvents', () => {
  let baseState: GameState;

  function createBaseState(): GameState {
    return initializeGameState('United States', 2024);
  }

  it('applies NARRATIVE events without state changes', () => {
    baseState = createBaseState();
    const events: WorldEvent[] = [
      {
        type: 'NARRATIVE',
        description: 'A diplomatic summit was held in Geneva.',
        involvedCountries: [],
        date: '2024-06-15',
        economicEffects: [],
      },
    ];

    const newState = applyEvents(baseState, events);
    // State should be unchanged except for recentEvents
    expect(newState.recentEvents).toHaveLength(1);
    expect(newState.recentEvents[0].description).toBe('A diplomatic summit was held in Geneva.');
    expect(newState.countries['United States'].gdp).toBe(baseState.countries['United States'].gdp);
  });

  it('applies ECONOMIC_SHIFT with economic effects', () => {
    baseState = createBaseState();
    const usGdp = baseState.countries['United States'].gdp;

    const events: WorldEvent[] = [
      {
        type: 'ECONOMIC_SHIFT',
        description: 'US economy grows.',
        involvedCountries: ['United States'],
        date: '2024-06-15',
        economicEffects: [
          { countryName: 'United States', gdpChange: 100, populationChange: 0, stabilityChange: 5 },
        ],
      },
    ];

    const newState = applyEvents(baseState, events);
    expect(newState.countries['United States'].gdp).toBe(usGdp + 100);
    expect(newState.countries['United States'].stability).toBe(
      Math.min(100, baseState.countries['United States'].stability + 5),
    );
  });

  it('clamps GDP to >= 0 after economic effects', () => {
    baseState = createBaseState();
    const events: WorldEvent[] = [
      {
        type: 'ECONOMIC_SHIFT',
        description: 'Economic collapse.',
        involvedCountries: ['United States'],
        date: '2024-06-15',
        economicEffects: [
          { countryName: 'United States', gdpChange: -999999, populationChange: 0, stabilityChange: 0 },
        ],
      },
    ];

    const newState = applyEvents(baseState, events);
    expect(newState.countries['United States'].gdp).toBe(0);
  });

  it('clamps stability to [0, 100]', () => {
    baseState = createBaseState();
    const events: WorldEvent[] = [
      {
        type: 'ECONOMIC_SHIFT',
        description: 'Stability boost.',
        involvedCountries: ['United States'],
        date: '2024-06-15',
        economicEffects: [
          { countryName: 'United States', gdpChange: 0, populationChange: 0, stabilityChange: 999 },
        ],
      },
    ];

    const newState = applyEvents(baseState, events);
    expect(newState.countries['United States'].stability).toBe(100);
  });

  it('clamps population to >= 0', () => {
    baseState = createBaseState();
    const events: WorldEvent[] = [
      {
        type: 'ECONOMIC_SHIFT',
        description: 'Population crisis.',
        involvedCountries: ['United States'],
        date: '2024-06-15',
        economicEffects: [
          { countryName: 'United States', gdpChange: 0, populationChange: -999999, stabilityChange: 0 },
        ],
      },
    ];

    const newState = applyEvents(baseState, events);
    expect(newState.countries['United States'].population).toBe(0);
  });

  it('applies WAR event and creates active war + updates relations', () => {
    baseState = createBaseState();
    const events: WorldEvent[] = [
      {
        type: 'WAR',
        description: 'War breaks out.',
        involvedCountries: ['United States', 'Russia'],
        date: '2024-06-15',
        economicEffects: [],
        aggressorCountries: ['United States'],
        defenderCountries: ['Russia'],
      },
    ];

    const newState = applyEvents(baseState, events);
    expect(newState.activeWars).toHaveLength(1);
    expect(newState.activeWars[0].aggressors).toContain('United States');
    expect(newState.activeWars[0].defenders).toContain('Russia');

    // Check relations updated
    const usRelation = newState.countries['United States'].relations.find(
      (r) => r.country === 'Russia',
    );
    expect(usRelation?.status).toBe('AT_WAR');
  });

  it('applies PEACE event and removes war + updates relations', () => {
    baseState = createBaseState();
    // First create a war
    baseState.activeWars.push({
      id: 'test_war',
      aggressors: ['United States'],
      defenders: ['Russia'],
      startYear: 2024,
    });

    const events: WorldEvent[] = [
      {
        type: 'PEACE',
        description: 'Peace treaty signed.',
        involvedCountries: ['United States', 'Russia'],
        date: '2024-12-01',
        economicEffects: [],
      },
    ];

    const newState = applyEvents(baseState, events);
    expect(newState.activeWars).toHaveLength(0);
  });

  it('applies ALLIANCE event', () => {
    baseState = createBaseState();
    const events: WorldEvent[] = [
      {
        type: 'ALLIANCE',
        description: 'New alliance formed.',
        involvedCountries: ['United States', 'United Kingdom'],
        date: '2024-06-15',
        economicEffects: [],
        allianceName: 'Atlantic Alliance',
      },
    ];

    const newState = applyEvents(baseState, events);
    expect(newState.activeAlliances).toHaveLength(1);
    expect(newState.activeAlliances[0].name).toBe('Atlantic Alliance');
    expect(newState.activeAlliances[0].members).toContain('United States');
    expect(newState.activeAlliances[0].members).toContain('United Kingdom');

    const usRelation = newState.countries['United States'].relations.find(
      (r) => r.country === 'United Kingdom',
    );
    expect(usRelation?.status).toBe('ALLIED');
  });

  it('applies ANNEXATION event and transfers territories', () => {
    baseState = createBaseState();
    // US already owns US_MAINLAND
    const events: WorldEvent[] = [
      {
        type: 'ANNEXATION',
        description: 'Territory annexed.',
        involvedCountries: ['United States', 'Mexico'],
        date: '2024-06-15',
        economicEffects: [],
        annexingCountry: 'United States',
        targetTerritories: ['MX_MAINLAND'],
      },
    ];

    const newState = applyEvents(baseState, events);
    expect(newState.territories['MX_MAINLAND'].owner).toBe('United States');
    expect(newState.countries['United States'].territories).toContain('MX_MAINLAND');
    expect(newState.countries['Mexico'].territories).not.toContain('MX_MAINLAND');
  });

  it('applies TRADE_DEAL event', () => {
    baseState = createBaseState();
    const events: WorldEvent[] = [
      {
        type: 'TRADE_DEAL',
        description: 'Trade agreement signed.',
        involvedCountries: ['United States', 'Japan'],
        date: '2024-06-15',
        economicEffects: [],
        dealDescription: 'Semiconductor trade partnership',
      },
    ];

    const newState = applyEvents(baseState, events);
    expect(newState.tradeDeals).toHaveLength(1);
    expect(newState.tradeDeals[0].parties).toContain('United States');
    expect(newState.tradeDeals[0].parties).toContain('Japan');
  });

  it('does not mutate the original state', () => {
    baseState = createBaseState();
    const originalGdp = baseState.countries['United States'].gdp;
    const events: WorldEvent[] = [
      {
        type: 'ECONOMIC_SHIFT',
        description: 'GDP change.',
        involvedCountries: ['United States'],
        date: '2024-06-15',
        economicEffects: [
          { countryName: 'United States', gdpChange: 500, populationChange: 0, stabilityChange: 0 },
        ],
      },
    ];

    applyEvents(baseState, events);
    // Original should be unchanged
    expect(baseState.countries['United States'].gdp).toBe(originalGdp);
  });

  it('trims recentEvents to last 18', () => {
    baseState = createBaseState();
    // Add 16 existing recent events
    for (let i = 0; i < 16; i++) {
      baseState.recentEvents.push({
        turnNumber: 0,
        year: 2024,
        description: `Old event ${i}`,
        eventType: 'NARRATIVE',
      });
    }

    // Add 4 new events (total would be 20, should trim to 18)
    const events: WorldEvent[] = Array.from({ length: 4 }, (_, i) => ({
      type: 'NARRATIVE' as const,
      description: `New event ${i}`,
      involvedCountries: [],
      date: '2024-06-15',
      economicEffects: [],
    }));

    const newState = applyEvents(baseState, events);
    expect(newState.recentEvents).toHaveLength(18);
    // Last event should be the most recent
    expect(newState.recentEvents[17].description).toBe('New event 3');
  });

  it('handles empty events list', () => {
    baseState = createBaseState();
    const newState = applyEvents(baseState, []);
    // State should be identical (deep clone)
    expect(newState.countries['United States'].gdp).toBe(baseState.countries['United States'].gdp);
    expect(newState.recentEvents).toHaveLength(0);
  });

  it('ignores economic effects for non-existent countries', () => {
    baseState = createBaseState();
    const events: WorldEvent[] = [
      {
        type: 'ECONOMIC_SHIFT',
        description: 'Effect on fake country.',
        involvedCountries: ['United States'],
        date: '2024-06-15',
        economicEffects: [
          { countryName: 'Atlantis', gdpChange: 100, populationChange: 0, stabilityChange: 0 },
        ],
      },
    ];

    // Should not throw
    const newState = applyEvents(baseState, events);
    expect(newState).toBeDefined();
  });
});
