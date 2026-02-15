import type {
  WorldEvent,
  GameState,
  NarrativeFallbackEvent,
  AnnexationEvent,
  WarEvent,
} from '@faxhistoria/shared';
import { ALLOWED_EVENT_TYPES } from '@faxhistoria/shared';

export interface ArbiterResult {
  approved: WorldEvent[];
  degraded: Array<{
    original: WorldEvent;
    reason: string;
    fallback: NarrativeFallbackEvent;
  }>;
}

/**
 * Arbitrate AI-generated events against game rules.
 * Invalid events are degraded to NARRATIVE_FALLBACK rather than rejected.
 */
export function arbitrateEvents(
  events: WorldEvent[],
  state: GameState,
): ArbiterResult {
  const approved: WorldEvent[] = [];
  const degraded: ArbiterResult['degraded'] = [];

  for (const event of events) {
    const issues = validateEvent(event, state);
    if (issues.length === 0) {
      // Clamp economic effects (fix but don't degrade)
      clampEconomicEffects(event, state);
      approved.push(event);
    } else {
      degraded.push({
        original: event,
        reason: issues.join('; '),
        fallback: toNarrativeFallback(event, issues),
      });
    }
  }

  return { approved, degraded };
}

/**
 * Validate a single event against game state and rules.
 */
function validateEvent(event: WorldEvent, state: GameState): string[] {
  const issues: string[] = [];

  // 1. Event type whitelist (already handled by Zod, but double-check)
  if (!ALLOWED_EVENT_TYPES.includes(event.type as any)) {
    issues.push(`Unknown event type: ${event.type}`);
    return issues; // No point checking further
  }

  // 2. Referenced entities must exist
  for (const country of event.involvedCountries) {
    if (!(country in state.countries)) {
      issues.push(`Country does not exist: ${country}`);
    }
  }

  // 3. Type-specific validations
  switch (event.type) {
    case 'ANNEXATION':
      issues.push(...validateAnnexation(event, state));
      break;
    case 'WAR':
      issues.push(...validateWar(event, state));
      break;
    case 'ALLIANCE':
      issues.push(...validateAlliance(event, state));
      break;
    case 'PEACE':
      issues.push(...validatePeace(event, state));
      break;
  }

  // 4. Economic effects reference existing countries
  for (const effect of event.economicEffects) {
    if (!(effect.countryName in state.countries)) {
      issues.push(`Economic effect references non-existent country: ${effect.countryName}`);
    }
  }

  return issues;
}

function validateAnnexation(event: AnnexationEvent, state: GameState): string[] {
  const issues: string[] = [];

  // Annexing country must exist
  if (!(event.annexingCountry in state.countries)) {
    issues.push(`Annexing country does not exist: ${event.annexingCountry}`);
    return issues;
  }

  const annexer = state.countries[event.annexingCountry];

  // Target territories must exist
  for (const territoryId of event.targetTerritories) {
    const territory = state.territories[territoryId];
    if (!territory) {
      issues.push(`Territory does not exist: ${territoryId}`);
      continue;
    }

    const owner = territory.owner;
    if (owner === event.annexingCountry) {
      issues.push(`${event.annexingCountry} already owns territory ${territoryId}`);
      continue;
    }

    // Must be at war or have 2x military advantage
    const defender = state.countries[owner];
    if (defender) {
      const atWar = isAtWar(event.annexingCountry, owner, state);
      const hasAdvantage = annexer.military.strength >= defender.military.strength * 2;

      if (!atWar && !hasAdvantage) {
        issues.push(
          `${event.annexingCountry} cannot annex from ${owner}: no war and insufficient military advantage (${annexer.military.strength} vs ${defender.military.strength})`,
        );
      }
    }
  }

  return issues;
}

function validateWar(event: WarEvent, state: GameState): string[] {
  const issues: string[] = [];

  for (const country of event.aggressorCountries) {
    if (!(country in state.countries)) {
      issues.push(`Aggressor country does not exist: ${country}`);
    }
  }

  for (const country of event.defenderCountries) {
    if (!(country in state.countries)) {
      issues.push(`Defender country does not exist: ${country}`);
    }
  }

  // Check if already at war (all aggressors vs all defenders)
  for (const aggressor of event.aggressorCountries) {
    for (const defender of event.defenderCountries) {
      if (isAtWar(aggressor, defender, state)) {
        issues.push(`${aggressor} and ${defender} are already at war`);
      }
    }
  }

  return issues;
}

function validateAlliance(event: WorldEvent, state: GameState): string[] {
  const issues: string[] = [];

  // Check if any involved countries are at war with each other
  for (let i = 0; i < event.involvedCountries.length; i++) {
    for (let j = i + 1; j < event.involvedCountries.length; j++) {
      if (isAtWar(event.involvedCountries[i], event.involvedCountries[j], state)) {
        issues.push(
          `Cannot form alliance: ${event.involvedCountries[i]} and ${event.involvedCountries[j]} are at war`,
        );
      }
    }
  }

  return issues;
}

function validatePeace(event: WorldEvent, state: GameState): string[] {
  const issues: string[] = [];

  // At least some of the involved countries should be at war
  let anyAtWar = false;
  for (let i = 0; i < event.involvedCountries.length; i++) {
    for (let j = i + 1; j < event.involvedCountries.length; j++) {
      if (isAtWar(event.involvedCountries[i], event.involvedCountries[j], state)) {
        anyAtWar = true;
        break;
      }
    }
    if (anyAtWar) break;
  }

  if (!anyAtWar && event.involvedCountries.length >= 2) {
    issues.push('Peace event but no active war between involved countries');
  }

  return issues;
}

/**
 * Check if two countries are currently at war.
 */
function isAtWar(country1: string, country2: string, state: GameState): boolean {
  return state.activeWars.some(
    (war) =>
      (war.aggressors.includes(country1) && war.defenders.includes(country2)) ||
      (war.aggressors.includes(country2) && war.defenders.includes(country1)),
  );
}

export { isAtWar };

/**
 * Clamp economic effects to prevent invalid state (GDP < 0, stability out of range, etc.)
 */
function clampEconomicEffects(event: WorldEvent, state: GameState): void {
  for (const effect of event.economicEffects) {
    const country = state.countries[effect.countryName];
    if (!country) continue;

    // GDP cannot go below 0
    if (country.gdp + effect.gdpChange < 0) {
      effect.gdpChange = -country.gdp;
    }

    // Population cannot go below 0
    if (country.population + effect.populationChange < 0) {
      effect.populationChange = -country.population;
    }

    // Stability must stay in [0, 100]
    const newStability = country.stability + effect.stabilityChange;
    effect.stabilityChange = Math.max(0, Math.min(100, newStability)) - country.stability;
  }
}

/**
 * Convert an invalid event to a NARRATIVE_FALLBACK.
 */
function toNarrativeFallback(
  event: WorldEvent,
  issues: string[],
): NarrativeFallbackEvent {
  return {
    type: 'NARRATIVE_FALLBACK',
    description: `[Degraded] ${event.description}`,
    involvedCountries: event.involvedCountries.filter(Boolean),
    date: event.date,
    economicEffects: [],
    originalType: event.type,
    degradeReason: issues.join('; '),
  };
}
