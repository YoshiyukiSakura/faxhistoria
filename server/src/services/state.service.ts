import { createHash } from 'crypto';
import {
  INITIAL_COUNTRIES,
  type GameState,
  type Country,
  type Territory,
  type WorldEvent,
  type AnnexationEvent,
  type WarEvent,
  type PeaceEvent,
  type AllianceEvent,
  type TradeDealEvent,
} from '@faxhistoria/shared';

function deterministicId(prefix: string, ...parts: string[]): string {
  const hash = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 8);
  return `${prefix}_${hash}`;
}

export function initializeGameState(playerCountry: string, startYear: number): GameState {
  // Build countries with default NEUTRAL relations to all other countries
  const countryNames = Object.keys(INITIAL_COUNTRIES);
  const countries: Record<string, Country> = {};
  const territories: Record<string, Territory> = {};

  for (const name of countryNames) {
    const base = INITIAL_COUNTRIES[name];
    const relations = countryNames
      .filter((other) => other !== name)
      .map((other) => ({
        country: other,
        status: 'NEUTRAL' as const,
      }));

    countries[name] = { ...base, relations };

    // Create territory records from the country's territory list
    for (const territoryId of base.territories) {
      territories[territoryId] = {
        id: territoryId,
        name: territoryId.replace(/_/g, ' '),
        owner: name,
        population: Math.round((base.population / base.territories.length) * 10) / 10,
        gdpContribution: Math.round((base.gdp / base.territories.length) * 10) / 10,
      };
    }
  }

  return {
    countries,
    territories,
    playerCountry,
    currentYear: startYear,
    turnNumber: 0,
    activeWars: [],
    activeAlliances: [],
    tradeDeals: [],
    recentEvents: [],
    worldNarrative: `The year is ${startYear}. The world stands at a crossroads of geopolitical tension and opportunity. As the leader of ${playerCountry}, your decisions will shape the course of history.`,
  };
}

// ── Event Handler Registry (Reducer Pattern) ──

type EventHandler = (state: GameState, event: WorldEvent, eventIndex: number) => GameState;

const eventHandlers: Record<string, EventHandler> = {
  ALLIANCE: handleAlliance,
  ANNEXATION: handleAnnexation,
  TRADE_DEAL: handleTradeDeal,
  WAR: handleWar,
  PEACE: handlePeace,
  NARRATIVE: handleNarrative,
  ECONOMIC_SHIFT: handleEconomicShift,
  NARRATIVE_FALLBACK: handleNarrative,
};

/**
 * Apply a list of events to a game state, returning a new state.
 * Pure function - does not mutate input state.
 */
export function applyEvents(state: GameState, events: WorldEvent[]): GameState {
  let newState = deepCloneState(state);

  for (let idx = 0; idx < events.length; idx++) {
    const event = events[idx];
    const handler = eventHandlers[event.type];
    if (handler) {
      newState = handler(newState, event, idx);
    }
    newState = applyEconomicEffects(newState, event);

    newState.recentEvents.push({
      turnNumber: newState.turnNumber,
      year: newState.currentYear,
      description: event.description,
      eventType: event.type,
      ...(event.imageSeed !== undefined ? { imageSeed: event.imageSeed } : {}),
      ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
    });
  }

  // Keep only last 18 recent events (~3 turns × 6 events)
  if (newState.recentEvents.length > 18) {
    newState.recentEvents = newState.recentEvents.slice(-18);
  }

  return newState;
}

// ── Individual Event Handlers ──

function handleAlliance(state: GameState, event: WorldEvent, eventIndex: number): GameState {
  const e = event as AllianceEvent;
  const allianceId = deterministicId('alliance', String(state.currentYear), String(eventIndex), ...e.involvedCountries.sort(), e.allianceName);

  state.activeAlliances.push({
    id: allianceId,
    members: [...e.involvedCountries],
    name: e.allianceName,
    formedYear: state.currentYear,
  });

  for (const country of e.involvedCountries) {
    if (!state.countries[country]) continue;
    for (const other of e.involvedCountries) {
      if (country === other) continue;
      updateRelation(state, country, other, 'ALLIED');
    }
  }

  return state;
}

function handleAnnexation(state: GameState, event: WorldEvent, _eventIndex: number): GameState {
  const e = event as AnnexationEvent;
  const annexer = state.countries[e.annexingCountry];
  if (!annexer) return state;

  for (const territoryId of e.targetTerritories) {
    const territory = state.territories[territoryId];
    if (!territory) continue;

    const previousOwner = territory.owner;
    territory.owner = e.annexingCountry;

    if (state.countries[previousOwner]) {
      state.countries[previousOwner].territories = state.countries[
        previousOwner
      ].territories.filter((t) => t !== territoryId);
    }
    if (!annexer.territories.includes(territoryId)) {
      annexer.territories.push(territoryId);
    }
  }

  return state;
}

function handleTradeDeal(state: GameState, event: WorldEvent, eventIndex: number): GameState {
  const e = event as TradeDealEvent;
  state.tradeDeals.push({
    id: deterministicId('trade', String(state.currentYear), String(eventIndex), ...e.involvedCountries.sort(), e.dealDescription),
    parties: [...e.involvedCountries],
    description: e.dealDescription,
    startYear: state.currentYear,
  });

  for (const country of e.involvedCountries) {
    for (const other of e.involvedCountries) {
      if (country === other) continue;
      improveRelation(state, country, other);
    }
  }

  return state;
}

function handleWar(state: GameState, event: WorldEvent, eventIndex: number): GameState {
  const e = event as WarEvent;
  state.activeWars.push({
    id: deterministicId('war', String(state.currentYear), String(eventIndex), ...e.aggressorCountries.sort(), ...e.defenderCountries.sort()),
    aggressors: [...e.aggressorCountries],
    defenders: [...e.defenderCountries],
    startYear: state.currentYear,
  });

  for (const aggressor of e.aggressorCountries) {
    for (const defender of e.defenderCountries) {
      updateRelation(state, aggressor, defender, 'AT_WAR');
      updateRelation(state, defender, aggressor, 'AT_WAR');
    }
  }

  return state;
}

function handlePeace(state: GameState, event: WorldEvent, _eventIndex: number): GameState {
  const e = event as PeaceEvent;
  state.activeWars = state.activeWars.filter((war) => {
    const warCountries = [...war.aggressors, ...war.defenders];
    const overlap = e.involvedCountries.filter((c) => warCountries.includes(c));
    return overlap.length < 2;
  });

  for (let i = 0; i < e.involvedCountries.length; i++) {
    for (let j = i + 1; j < e.involvedCountries.length; j++) {
      updateRelation(state, e.involvedCountries[i], e.involvedCountries[j], 'NEUTRAL');
      updateRelation(state, e.involvedCountries[j], e.involvedCountries[i], 'NEUTRAL');
    }
  }

  return state;
}

function handleNarrative(_state: GameState, _event: WorldEvent, _eventIndex: number): GameState {
  return _state;
}

function handleEconomicShift(_state: GameState, _event: WorldEvent, _eventIndex: number): GameState {
  return _state;
}

// ── Helpers ──

function applyEconomicEffects(state: GameState, event: WorldEvent): GameState {
  for (const effect of event.economicEffects) {
    const country = state.countries[effect.countryName];
    if (!country) continue;
    country.gdp = Math.max(0, country.gdp + effect.gdpChange);
    country.population = Math.max(0, country.population + effect.populationChange);
    country.stability = Math.max(0, Math.min(100, country.stability + effect.stabilityChange));
  }
  return state;
}

function updateRelation(
  state: GameState,
  country: string,
  target: string,
  status: 'ALLIED' | 'FRIENDLY' | 'NEUTRAL' | 'HOSTILE' | 'AT_WAR',
): void {
  const c = state.countries[country];
  if (!c) return;
  const existing = c.relations.find((r) => r.country === target);
  if (existing) {
    existing.status = status;
  } else {
    c.relations.push({ country: target, status });
  }
}

function improveRelation(state: GameState, country: string, target: string): void {
  const c = state.countries[country];
  if (!c) return;
  const existing = c.relations.find((r) => r.country === target);
  if (existing) {
    const ladder: Array<'HOSTILE' | 'NEUTRAL' | 'FRIENDLY' | 'ALLIED'> = [
      'HOSTILE', 'NEUTRAL', 'FRIENDLY', 'ALLIED',
    ];
    const idx = ladder.indexOf(existing.status as any);
    if (idx >= 0 && idx < ladder.length - 1) {
      existing.status = ladder[idx + 1];
    }
  } else {
    c.relations.push({ country: target, status: 'FRIENDLY' });
  }
}

function deepCloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}
