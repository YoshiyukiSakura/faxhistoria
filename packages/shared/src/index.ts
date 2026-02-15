// ── Schemas ──
export {
  TerritorySchema,
  MilitarySchema,
  DiplomaticRelationSchema,
  CountrySchema,
  RecentEventSummarySchema,
  GameStateSchema,
} from './schemas/game-state';

export {
  ALLOWED_EVENT_TYPES,
  EconomicEffectSchema,
  AllianceEventSchema,
  AnnexationEventSchema,
  TradeDealEventSchema,
  WarEventSchema,
  PeaceEventSchema,
  NarrativeEventSchema,
  EconomicShiftEventSchema,
  NarrativeFallbackEventSchema,
  WorldEventSchema,
  AISimulationResponseSchema,
} from './schemas/world-events';

export {
  RegisterRequestSchema,
  LoginRequestSchema,
  AuthResponseSchema,
  CreateGameRequestSchema,
  SubmitTurnRequestSchema,
  TurnResponseSchema,
  TurnProgressStageSchema,
  TurnProgressEventSchema,
  ErrorResponseSchema,
} from './schemas/api';

// ── Types ──
export type {
  Territory,
  Military,
  DiplomaticRelation,
  Country,
  RecentEventSummary,
  GameState,
} from './schemas/game-state';

export type {
  EventType,
  EconomicEffect,
  AllianceEvent,
  AnnexationEvent,
  TradeDealEvent,
  WarEvent,
  PeaceEvent,
  NarrativeEvent,
  EconomicShiftEvent,
  NarrativeFallbackEvent,
  WorldEvent,
  AISimulationResponse,
} from './schemas/world-events';

export type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  CreateGameRequest,
  SubmitTurnRequest,
  TurnResponse,
  TurnProgressStage,
  TurnProgressEvent,
  ErrorResponse,
} from './schemas/api';

// ── Constants ──
export { INITIAL_COUNTRIES, SELECTABLE_COUNTRIES, getDefaultCountry } from './constants/countries';
export { UI_COLORS, EVENT_TYPE_COLORS, DEFAULT_COUNTRY_COLORS } from './constants/colors';

// ── Utils ──
export { validateWithSchema, generateIdempotencyKey } from './utils/validation';
export { hashObject } from './utils/hash';
