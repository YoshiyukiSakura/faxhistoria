import type { GameState, AISimulationResponse } from '@faxhistoria/shared';
import { AISimulationResponseSchema } from '@faxhistoria/shared';
import { callDeepSeek, type AICallResult, type AIUsage } from './deepseek-client';
import { buildSystemPrompt, buildUserPrompt, getContextBudget } from './prompts/simulation.prompt';
import { arbitrateEvents, type ArbiterResult } from './rule-arbiter';

export interface SimulationResult {
  arbiterResult: ArbiterResult;
  worldNarrative: string;
  yearSummary: string;
  usage: AIUsage;
  latencyMs: number;
}

/**
 * Run a full simulation turn: call AI → validate → arbitrate.
 */
export async function runSimulation(
  state: GameState,
  playerAction: string,
): Promise<SimulationResult> {
  const systemPrompt = buildSystemPrompt();
  const contextBudget = getContextBudget(state);
  const userPrompt = buildUserPrompt(state, playerAction, contextBudget);

  // Call DeepSeek with Zod validation
  const result: AICallResult<AISimulationResponse> = await callDeepSeek(
    systemPrompt,
    userPrompt,
    AISimulationResponseSchema,
    2, // max retries
  );

  // Arbitrate events against game rules
  const arbiterResult = arbitrateEvents(result.data.events, state);

  return {
    arbiterResult,
    worldNarrative: result.data.worldNarrative,
    yearSummary: result.data.yearSummary,
    usage: result.usage,
    latencyMs: result.latencyMs,
  };
}
