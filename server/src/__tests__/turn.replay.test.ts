import { describe, it, expect } from 'vitest';
import { applyEvents, initializeGameState } from '../services/state.service';
import type { WorldEvent } from '@faxhistoria/shared';

describe('Replay determinism', () => {
  const baseEvents: WorldEvent[] = [
    {
      type: 'ALLIANCE',
      description: 'NATO expansion',
      involvedCountries: ['United States', 'United Kingdom'],
      date: '2024-06-15',
      economicEffects: [],
      allianceName: 'Atlantic Alliance',
    },
    {
      type: 'TRADE_DEAL',
      description: 'Semiconductor trade partnership signed.',
      involvedCountries: ['United States', 'Japan'],
      date: '2024-07-01',
      economicEffects: [],
      dealDescription: 'Semiconductor trade partnership',
    },
    {
      type: 'WAR',
      description: 'Conflict erupts.',
      involvedCountries: ['Russia', 'Ukraine'],
      date: '2024-08-01',
      economicEffects: [],
      aggressorCountries: ['Russia'],
      defenderCountries: ['Ukraine'],
    },
  ];

  it('produces identical output when called twice with same inputs', () => {
    const state = initializeGameState('United States', 2024);

    const result1 = applyEvents(state, baseEvents);
    const result2 = applyEvents(state, baseEvents);

    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });

  it('generates deterministic alliance IDs', () => {
    const state = initializeGameState('United States', 2024);
    const result = applyEvents(state, baseEvents);

    expect(result.activeAlliances[0].id).toMatch(/^alliance_[0-9a-f]{8}$/);

    // Run again — same ID
    const result2 = applyEvents(state, baseEvents);
    expect(result2.activeAlliances[0].id).toBe(result.activeAlliances[0].id);
  });

  it('generates deterministic trade deal IDs', () => {
    const state = initializeGameState('United States', 2024);
    const result = applyEvents(state, baseEvents);

    expect(result.tradeDeals[0].id).toMatch(/^trade_[0-9a-f]{8}$/);

    const result2 = applyEvents(state, baseEvents);
    expect(result2.tradeDeals[0].id).toBe(result.tradeDeals[0].id);
  });

  it('generates deterministic war IDs', () => {
    const state = initializeGameState('United States', 2024);
    const result = applyEvents(state, baseEvents);

    expect(result.activeWars[0].id).toMatch(/^war_[0-9a-f]{8}$/);

    const result2 = applyEvents(state, baseEvents);
    expect(result2.activeWars[0].id).toBe(result.activeWars[0].id);
  });

  it('generates unique IDs for duplicate event payloads at different indices', () => {
    const state = initializeGameState('United States', 2024);
    const duplicateEvents: WorldEvent[] = [
      {
        type: 'ALLIANCE',
        description: 'Same alliance formed.',
        involvedCountries: ['United States', 'United Kingdom'],
        date: '2024-06-15',
        economicEffects: [],
        allianceName: 'Atlantic Alliance',
      },
      {
        type: 'ALLIANCE',
        description: 'Same alliance formed again.',
        involvedCountries: ['United States', 'United Kingdom'],
        date: '2024-06-15',
        economicEffects: [],
        allianceName: 'Atlantic Alliance',
      },
    ];

    const result = applyEvents(state, duplicateEvents);
    expect(result.activeAlliances).toHaveLength(2);
    expect(result.activeAlliances[0].id).not.toBe(result.activeAlliances[1].id);
  });

  it('generates unique IDs for duplicate trade deals at different indices', () => {
    const state = initializeGameState('United States', 2024);
    const duplicateEvents: WorldEvent[] = [
      {
        type: 'TRADE_DEAL',
        description: 'Same trade deal.',
        involvedCountries: ['United States', 'Japan'],
        date: '2024-06-15',
        economicEffects: [],
        dealDescription: 'Chip deal',
      },
      {
        type: 'TRADE_DEAL',
        description: 'Same trade deal again.',
        involvedCountries: ['United States', 'Japan'],
        date: '2024-06-15',
        economicEffects: [],
        dealDescription: 'Chip deal',
      },
    ];

    const result = applyEvents(state, duplicateEvents);
    expect(result.tradeDeals).toHaveLength(2);
    expect(result.tradeDeals[0].id).not.toBe(result.tradeDeals[1].id);
  });
});
