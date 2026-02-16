import { z } from 'zod';

// ── Territory Schema ──
export const TerritorySchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),           // country name
  population: z.number().min(0),  // millions
  gdpContribution: z.number().min(0), // billions USD
});

// ── Military Schema ──
export const MilitarySchema = z.object({
  strength: z.number().min(0),        // aggregate military power index
  nuclearCapable: z.boolean(),
  defenseBudget: z.number().min(0),   // billions USD
});

// ── Diplomatic Relation ──
export const DiplomaticRelationSchema = z.object({
  country: z.string(),
  status: z.enum(['ALLIED', 'FRIENDLY', 'NEUTRAL', 'HOSTILE', 'AT_WAR']),
});

// ── Country Schema ──
export const CountrySchema = z.object({
  name: z.string(),
  displayName: z.string(),
  gdp: z.number().min(0),           // billions USD
  population: z.number().min(0),     // millions
  stability: z.number().min(0).max(100),
  military: MilitarySchema,
  territories: z.array(z.string()),  // territory IDs
  relations: z.array(DiplomaticRelationSchema),
  government: z.string(),
  leader: z.string(),
  color: z.string(),                 // hex color for map
});

// ── Recent Event Summary (for context) ──
export const RecentEventSummarySchema = z.object({
  turnNumber: z.number(),
  year: z.number(),
  description: z.string(),
  eventType: z.string(),
  imageSeed: z.number().int().nonnegative().optional(),
  imageUrl: z.string().max(2048).optional(),
});

// ── Full Game State ──
export const GameStateSchema = z.object({
  countries: z.record(z.string(), CountrySchema),
  territories: z.record(z.string(), TerritorySchema),
  playerCountry: z.string(),
  currentYear: z.number(),
  turnNumber: z.number(),
  activeWars: z.array(z.object({
    id: z.string(),
    aggressors: z.array(z.string()),
    defenders: z.array(z.string()),
    startYear: z.number(),
  })),
  activeAlliances: z.array(z.object({
    id: z.string(),
    members: z.array(z.string()),
    name: z.string(),
    formedYear: z.number(),
  })),
  tradeDeals: z.array(z.object({
    id: z.string(),
    parties: z.array(z.string()),
    description: z.string(),
    startYear: z.number(),
  })),
  recentEvents: z.array(RecentEventSummarySchema),
  worldNarrative: z.string(),  // current world situation summary
});

// ── Types ──
export type Territory = z.infer<typeof TerritorySchema>;
export type Military = z.infer<typeof MilitarySchema>;
export type DiplomaticRelation = z.infer<typeof DiplomaticRelationSchema>;
export type Country = z.infer<typeof CountrySchema>;
export type RecentEventSummary = z.infer<typeof RecentEventSummarySchema>;
export type GameState = z.infer<typeof GameStateSchema>;
