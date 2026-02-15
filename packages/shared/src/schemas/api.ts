import { z } from 'zod';

// ── Auth Schemas ──
export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  displayName: z.string().min(1).max(50),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const GuestLoginRequestSchema = z.object({}).strict();

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
  }),
});

// ── Game Schemas ──
export const CreateGameRequestSchema = z.object({
  name: z.string().min(1).max(100),
  playerCountry: z.string(),
  startYear: z.number().int().min(1900).max(2024).default(2024),
});

// ── Admin Schemas ──
export const AdminTokenUsageStatsSchema = z.object({
  totalModelRuns: z.number().int().min(0),
  successfulModelRuns: z.number().int().min(0),
  failedModelRuns: z.number().int().min(0),
  promptTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
});

export const AdminPlayerDetailSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().min(1).max(50),
  createdAt: z.string(),
  lastCallDate: z.string().nullable(),
  dailyApiCalls: z.number().int().min(0),
  totalGames: z.number().int().min(0),
  activeGames: z.number().int().min(0),
  completedGames: z.number().int().min(0),
  abandonedGames: z.number().int().min(0),
  latestGameAt: z.string().nullable(),
});

export const AdminStatsResponseSchema = z.object({
  generatedAt: z.string(),
  playerCount: z.number().int().min(0),
  activePlayerCount: z.number().int().min(0),
  tokenUsage: AdminTokenUsageStatsSchema,
  players: z.array(AdminPlayerDetailSchema),
});

// ── Turn Schemas ──
export const SubmitTurnRequestSchema = z.object({
  action: z.string().min(1).max(2000),
  expectedTurnNumber: z.number().int().min(0),
});

// P0 fix: Full turn response structure for idempotent caching
export const TurnResponseSchema = z.object({
  turnId: z.string(),
  turnNumber: z.number(),
  year: z.number(),
  events: z.array(z.object({
    type: z.string(),
    description: z.string(),
    involvedCountries: z.array(z.string()),
  })),
  worldNarrative: z.string(),
  yearSummary: z.string(),
  stateVersion: z.number(), // turnNumber serves as version
});

export const TurnProgressStageSchema = z.enum([
  'VALIDATING',
  'PROCESSING_AI',
  'AI_RETRY',
  'APPLYING_EVENTS',
  'PERSISTING',
  'COMPLETED',
  'FAILED',
]);

export const TurnStreamEventSchema = z.object({
  id: z.string(),
  sequence: z.number().int().min(1),
  total: z.number().int().min(1),
  type: z.string(),
  description: z.string(),
  involvedCountries: z.array(z.string()),
});

export const TurnDraftEventSchema = z.object({
  id: z.string(),
  sequence: z.number().int().min(1),
  type: z.string(),
  description: z.string(),
  involvedCountries: z.array(z.string()),
  isFinal: z.boolean(),
});

export const TurnProgressEventSchema = z.object({
  stage: TurnProgressStageSchema,
  progress: z.number().min(0).max(100),
  message: z.string(),
  timestamp: z.string(),
  attempt: z.number().int().min(1).optional(),
  totalAttempts: z.number().int().min(1).optional(),
  liveEvent: TurnStreamEventSchema.optional(),
  liveDraftEvent: TurnDraftEventSchema.optional(),
  result: TurnResponseSchema.optional(),
  error: z.object({
    message: z.string(),
    statusCode: z.number().optional(),
  }).optional(),
});

// ── Error Response ──
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  currentTurnNumber: z.number().optional(), // for 409 conflicts
});

// ── Types ──
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type GuestLoginRequest = z.infer<typeof GuestLoginRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type CreateGameRequest = z.infer<typeof CreateGameRequestSchema>;
export type AdminTokenUsageStats = z.infer<typeof AdminTokenUsageStatsSchema>;
export type AdminPlayerDetail = z.infer<typeof AdminPlayerDetailSchema>;
export type AdminStatsResponse = z.infer<typeof AdminStatsResponseSchema>;
export type SubmitTurnRequest = z.infer<typeof SubmitTurnRequestSchema>;
export type TurnResponse = z.infer<typeof TurnResponseSchema>;
export type TurnProgressStage = z.infer<typeof TurnProgressStageSchema>;
export type TurnStreamEvent = z.infer<typeof TurnStreamEventSchema>;
export type TurnDraftEvent = z.infer<typeof TurnDraftEventSchema>;
export type TurnProgressEvent = z.infer<typeof TurnProgressEventSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
