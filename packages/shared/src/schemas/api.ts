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
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type CreateGameRequest = z.infer<typeof CreateGameRequestSchema>;
export type SubmitTurnRequest = z.infer<typeof SubmitTurnRequestSchema>;
export type TurnResponse = z.infer<typeof TurnResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
