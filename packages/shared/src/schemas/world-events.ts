import { z } from 'zod';

// ── Event Type Whitelist ──
export const ALLOWED_EVENT_TYPES = [
  'ALLIANCE',
  'ANNEXATION',
  'TRADE_DEAL',
  'WAR',
  'PEACE',
  'NARRATIVE',
  'ECONOMIC_SHIFT',
  'NARRATIVE_FALLBACK',
] as const;

export type EventType = typeof ALLOWED_EVENT_TYPES[number];

// ── Economic Effect ──
export const EconomicEffectSchema = z.object({
  countryName: z.string(),
  gdpChange: z.number(),           // billions USD
  populationChange: z.number(),     // millions
  stabilityChange: z.number(),
});

// ── Base Event (internal - not exported directly) ──
const BaseEventFields = {
  description: z.string().max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  economicEffects: z.array(EconomicEffectSchema).default([]),
  imagePrompt: z.string().max(1000).optional(),
  imageSeed: z.number().int().nonnegative().optional(),
  imageUrl: z.string().max(2048).optional(),
};

// ── Specific Event Schemas ──
// P1 fix: WAR/ALLIANCE/ANNEXATION require .min(1) on involvedCountries

export const AllianceEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('ALLIANCE'),
  involvedCountries: z.array(z.string()).min(2), // at least 2 for alliance
  allianceName: z.string(),
});

export const AnnexationEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('ANNEXATION'),
  involvedCountries: z.array(z.string()).min(1),
  annexingCountry: z.string(),
  targetTerritories: z.array(z.string()).min(1),
});

export const TradeDealEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('TRADE_DEAL'),
  involvedCountries: z.array(z.string()).min(2),
  dealDescription: z.string(),
});

export const WarEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('WAR'),
  involvedCountries: z.array(z.string()).min(2),
  aggressorCountries: z.array(z.string()).min(1),
  defenderCountries: z.array(z.string()).min(1),
});

export const PeaceEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('PEACE'),
  involvedCountries: z.array(z.string()).min(2),
  warId: z.string().optional(), // reference to the war being ended
});

export const NarrativeEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('NARRATIVE'),
  involvedCountries: z.array(z.string()).default([]), // allowed empty
});

export const EconomicShiftEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('ECONOMIC_SHIFT'),
  involvedCountries: z.array(z.string()).min(1),
});

export const NarrativeFallbackEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('NARRATIVE_FALLBACK'),
  involvedCountries: z.array(z.string()).default([]), // allowed empty (degraded)
  originalType: z.string().optional(),
  degradeReason: z.string(),
});

// ── Discriminated Union ──
export const WorldEventSchema = z.discriminatedUnion('type', [
  AllianceEventSchema,
  AnnexationEventSchema,
  TradeDealEventSchema,
  WarEventSchema,
  PeaceEventSchema,
  NarrativeEventSchema,
  EconomicShiftEventSchema,
  NarrativeFallbackEventSchema,
]);

// ── AI Response Schema (what DeepSeek returns) ──
export const AISimulationResponseSchema = z.object({
  events: z.array(WorldEventSchema),
  worldNarrative: z.string().max(1000),
  yearSummary: z.string().max(500),
});

// ── Types ──
export type EconomicEffect = z.infer<typeof EconomicEffectSchema>;
export type AllianceEvent = z.infer<typeof AllianceEventSchema>;
export type AnnexationEvent = z.infer<typeof AnnexationEventSchema>;
export type TradeDealEvent = z.infer<typeof TradeDealEventSchema>;
export type WarEvent = z.infer<typeof WarEventSchema>;
export type PeaceEvent = z.infer<typeof PeaceEventSchema>;
export type NarrativeEvent = z.infer<typeof NarrativeEventSchema>;
export type EconomicShiftEvent = z.infer<typeof EconomicShiftEventSchema>;
export type NarrativeFallbackEvent = z.infer<typeof NarrativeFallbackEventSchema>;
export type WorldEvent = z.infer<typeof WorldEventSchema>;
export type AISimulationResponse = z.infer<typeof AISimulationResponseSchema>;
