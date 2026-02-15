import { describe, it, expect } from 'vitest';
import { arbitrateEvents } from '../services/ai/rule-arbiter';
import { initializeGameState } from '../services/state.service';
import type { WorldEvent, GameState } from '@faxhistoria/shared';

describe('rule-arbiter', () => {
  let state: GameState;

  function createState(): GameState {
    return initializeGameState('United States', 2024);
  }

  describe('event type validation', () => {
    it('approves valid NARRATIVE events', () => {
      state = createState();
      const events: WorldEvent[] = [
        {
          type: 'NARRATIVE',
          description: 'A peaceful year.',
          involvedCountries: [],
          date: '2024-06-15',
          economicEffects: [],
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(1);
      expect(result.degraded).toHaveLength(0);
    });
  });

  describe('country existence validation', () => {
    it('degrades events referencing non-existent countries', () => {
      state = createState();
      const events: WorldEvent[] = [
        {
          type: 'ECONOMIC_SHIFT',
          description: 'Economic boom in Atlantis.',
          involvedCountries: ['Atlantis'],
          date: '2024-06-15',
          economicEffects: [],
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(0);
      expect(result.degraded).toHaveLength(1);
      expect(result.degraded[0].fallback.type).toBe('NARRATIVE_FALLBACK');
      expect(result.degraded[0].reason).toContain('Country does not exist: Atlantis');
    });
  });

  describe('ANNEXATION validation', () => {
    it('degrades annexation without war or military advantage', () => {
      state = createState();
      const events: WorldEvent[] = [
        {
          type: 'ANNEXATION',
          description: 'US annexes Russian territory.',
          involvedCountries: ['United States', 'Russia'],
          date: '2024-06-15',
          economicEffects: [],
          annexingCountry: 'United States',
          targetTerritories: ['RU_MAINLAND'],
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(0);
      expect(result.degraded).toHaveLength(1);
      expect(result.degraded[0].reason).toContain('no war');
    });

    it('approves annexation with active war', () => {
      state = createState();
      state.activeWars.push({
        id: 'test_war',
        aggressors: ['United States'],
        defenders: ['Mexico'],
        startYear: 2024,
      });

      const events: WorldEvent[] = [
        {
          type: 'ANNEXATION',
          description: 'US annexes Mexican territory during war.',
          involvedCountries: ['United States', 'Mexico'],
          date: '2024-06-15',
          economicEffects: [],
          annexingCountry: 'United States',
          targetTerritories: ['MX_MAINLAND'],
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(1);
      expect(result.degraded).toHaveLength(0);
    });

    it('approves annexation with 2x military advantage', () => {
      state = createState();
      // US military strength is 1000, need target with <= 500
      // Argentina has 120, so US has way more than 2x advantage

      const events: WorldEvent[] = [
        {
          type: 'ANNEXATION',
          description: 'US annexes Argentine territory.',
          involvedCountries: ['United States', 'Argentina'],
          date: '2024-06-15',
          economicEffects: [],
          annexingCountry: 'United States',
          targetTerritories: ['AR_MAINLAND'],
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(1);
    });

    it('degrades annexation referencing non-existent territory', () => {
      state = createState();
      const events: WorldEvent[] = [
        {
          type: 'ANNEXATION',
          description: 'Annex fake territory.',
          involvedCountries: ['United States'],
          date: '2024-06-15',
          economicEffects: [],
          annexingCountry: 'United States',
          targetTerritories: ['FAKE_TERRITORY'],
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(0);
      expect(result.degraded).toHaveLength(1);
      expect(result.degraded[0].reason).toContain('Territory does not exist');
    });
  });

  describe('WAR validation', () => {
    it('approves valid war declaration', () => {
      state = createState();
      const events: WorldEvent[] = [
        {
          type: 'WAR',
          description: 'War declared.',
          involvedCountries: ['United States', 'Russia'],
          date: '2024-06-15',
          economicEffects: [],
          aggressorCountries: ['United States'],
          defenderCountries: ['Russia'],
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(1);
    });

    it('degrades war between countries already at war', () => {
      state = createState();
      state.activeWars.push({
        id: 'existing_war',
        aggressors: ['United States'],
        defenders: ['Russia'],
        startYear: 2024,
      });

      const events: WorldEvent[] = [
        {
          type: 'WAR',
          description: 'Another war declared.',
          involvedCountries: ['United States', 'Russia'],
          date: '2024-06-15',
          economicEffects: [],
          aggressorCountries: ['United States'],
          defenderCountries: ['Russia'],
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(0);
      expect(result.degraded).toHaveLength(1);
      expect(result.degraded[0].reason).toContain('already at war');
    });
  });

  describe('ALLIANCE validation', () => {
    it('degrades alliance between countries at war', () => {
      state = createState();
      state.activeWars.push({
        id: 'test_war',
        aggressors: ['United States'],
        defenders: ['Russia'],
        startYear: 2024,
      });

      const events: WorldEvent[] = [
        {
          type: 'ALLIANCE',
          description: 'Impossible alliance.',
          involvedCountries: ['United States', 'Russia'],
          date: '2024-06-15',
          economicEffects: [],
          allianceName: 'Impossible Alliance',
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(0);
      expect(result.degraded).toHaveLength(1);
      expect(result.degraded[0].reason).toContain('at war');
    });
  });

  describe('PEACE validation', () => {
    it('degrades peace between countries not at war', () => {
      state = createState();
      const events: WorldEvent[] = [
        {
          type: 'PEACE',
          description: 'Peace between peaceful nations.',
          involvedCountries: ['United States', 'Japan'],
          date: '2024-06-15',
          economicEffects: [],
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(0);
      expect(result.degraded).toHaveLength(1);
    });
  });

  describe('economic effect clamping', () => {
    it('clamps GDP to not go below 0', () => {
      state = createState();
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

      const result = arbitrateEvents(events, state);
      expect(result.approved).toHaveLength(1);
      // The gdpChange should be clamped
      const effect = result.approved[0].economicEffects[0];
      expect(effect.gdpChange).toBe(-state.countries['United States'].gdp);
    });

    it('clamps stability to [0, 100]', () => {
      state = createState();
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

      const result = arbitrateEvents(events, state);
      const effect = result.approved[0].economicEffects[0];
      expect(state.countries['United States'].stability + effect.stabilityChange).toBeLessThanOrEqual(100);
    });
  });

  describe('NARRATIVE_FALLBACK generation', () => {
    it('creates proper fallback from degraded event', () => {
      state = createState();
      const events: WorldEvent[] = [
        {
          type: 'ECONOMIC_SHIFT',
          description: 'Atlantis rises.',
          involvedCountries: ['Atlantis'],
          date: '2024-06-15',
          economicEffects: [],
        },
      ];

      const result = arbitrateEvents(events, state);
      expect(result.degraded).toHaveLength(1);
      const fallback = result.degraded[0].fallback;
      expect(fallback.type).toBe('NARRATIVE_FALLBACK');
      expect(fallback.originalType).toBe('ECONOMIC_SHIFT');
      expect(fallback.degradeReason).toBeTruthy();
      expect(fallback.description).toContain('[Degraded]');
    });
  });
});
