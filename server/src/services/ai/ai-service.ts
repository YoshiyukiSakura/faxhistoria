import type { GameState, AISimulationResponse, TurnDraftEvent } from '@faxhistoria/shared';
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

interface RunSimulationOptions {
  onAiAttempt?: (attempt: number, totalAttempts: number) => void;
  onAiDraftEvent?: (event: TurnDraftEvent) => void;
}

// Tune draft emission cadence to feel closer to live typing.
const DRAFT_MIN_DELTA_CHARS = 4;
const DRAFT_MIN_INTERVAL_MS = 90;

function decodePartialJsonString(input: string): string {
  return input
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim();
}

function parseInvolvedCountries(fragment: string): string[] {
  const match = fragment.match(/"involvedCountries"\s*:\s*\[([^\]]*)/s);
  if (!match) return [];
  const countries: string[] = [];
  const regex = /"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(match[1])) !== null) {
    if (m[1].trim()) {
      countries.push(m[1].trim());
    }
  }
  return countries;
}

function parseDraftEventFromFragment(
  fragment: string,
  sequence: number,
  attempt: number,
): TurnDraftEvent | null {
  const isFinal = fragment.trimEnd().endsWith('}');
  const id = `a${attempt}-e${sequence}`;

  if (isFinal) {
    try {
      const parsed = JSON.parse(fragment) as {
        type?: unknown;
        description?: unknown;
        involvedCountries?: unknown;
      };
      const type = typeof parsed.type === 'string' && parsed.type.trim() ? parsed.type.trim() : 'NARRATIVE';
      const description =
        typeof parsed.description === 'string' ? parsed.description.trim() : '';
      const involvedCountries = Array.isArray(parsed.involvedCountries)
        ? parsed.involvedCountries.filter((value): value is string => typeof value === 'string')
        : [];

      if (!description && involvedCountries.length === 0) {
        return null;
      }

      return {
        id,
        sequence,
        type,
        description,
        involvedCountries,
        isFinal: true,
      };
    } catch {
      // Fallback to partial parsing below.
    }
  }

  const typeMatch = fragment.match(/"type"\s*:\s*"([^"]*)/s);
  const descriptionMatch = fragment.match(/"description"\s*:\s*"([^"]*)/s);
  const type = typeMatch?.[1]?.trim() || 'NARRATIVE';
  const description = descriptionMatch ? decodePartialJsonString(descriptionMatch[1]) : '';
  const involvedCountries = parseInvolvedCountries(fragment);

  if (!description && involvedCountries.length === 0 && !typeMatch) {
    return null;
  }

  return {
    id,
    sequence,
    type,
    description,
    involvedCountries,
    isFinal,
  };
}

function extractDraftEventsFromStreamJson(
  jsonText: string,
  attempt: number,
): TurnDraftEvent[] {
  const eventsKeyMatch = /"events"\s*:\s*\[/s.exec(jsonText);
  if (!eventsKeyMatch || eventsKeyMatch.index === undefined) return [];

  const arrayStart = jsonText.indexOf('[', eventsKeyMatch.index);
  if (arrayStart < 0) return [];

  const drafts: TurnDraftEvent[] = [];
  let inString = false;
  let escaped = false;
  let objectDepth = 0;
  let arrayDepth = 1;
  let objectStart = -1;
  let sequence = 0;

  for (let i = arrayStart + 1; i < jsonText.length; i++) {
    const char = jsonText[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (objectDepth === 0) {
        objectStart = i;
        sequence += 1;
      }
      objectDepth += 1;
      continue;
    }

    if (char === '}') {
      if (objectDepth > 0) {
        objectDepth -= 1;
      }
      if (objectDepth === 0 && objectStart >= 0) {
        const fragment = jsonText.slice(objectStart, i + 1);
        const parsed = parseDraftEventFromFragment(fragment, sequence, attempt);
        if (parsed) {
          drafts.push(parsed);
        }
        objectStart = -1;
      }
      continue;
    }

    if (objectDepth === 0 && char === '[') {
      arrayDepth += 1;
      continue;
    }

    if (objectDepth === 0 && char === ']') {
      arrayDepth -= 1;
      if (arrayDepth <= 0) {
        break;
      }
    }
  }

  if (objectDepth > 0 && objectStart >= 0) {
    const fragment = jsonText.slice(objectStart);
    const parsed = parseDraftEventFromFragment(fragment, sequence, attempt);
    if (parsed) {
      drafts.push(parsed);
    }
  }

  return drafts;
}

/**
 * Run a full simulation turn: call AI → validate → arbitrate.
 */
export async function runSimulation(
  state: GameState,
  playerAction: string,
  options: RunSimulationOptions = {},
): Promise<SimulationResult> {
  const systemPrompt = buildSystemPrompt();
  const contextBudget = getContextBudget(state);
  const userPrompt = buildUserPrompt(state, playerAction, contextBudget);
  const draftState = new Map<
    string,
    { signature: string; descriptionLength: number; emittedAt: number }
  >();
  let activeAttempt = 0;

  // Call DeepSeek with Zod validation
  const result: AICallResult<AISimulationResponse> = await callDeepSeek(
    systemPrompt,
    userPrompt,
    AISimulationResponseSchema,
    2, // max retries
    options.onAiAttempt,
    (_chunk, accumulated, attempt) => {
      if (!options.onAiDraftEvent) {
        return;
      }

      if (attempt !== activeAttempt) {
        activeAttempt = attempt;
        draftState.clear();
      }

      const now = Date.now();
      const drafts = extractDraftEventsFromStreamJson(accumulated, attempt);
      for (const draft of drafts) {
        const signature = [
          draft.type,
          draft.description,
          draft.involvedCountries.join('|'),
          draft.isFinal ? '1' : '0',
        ].join('::');
        const previous = draftState.get(draft.id);
        if (previous?.signature === signature) {
          continue;
        }

        const enoughDelta =
          !previous || draft.description.length - previous.descriptionLength >= DRAFT_MIN_DELTA_CHARS;
        const enoughTime = !previous || now - previous.emittedAt >= DRAFT_MIN_INTERVAL_MS;
        if (!draft.isFinal && !enoughDelta && !enoughTime) {
          continue;
        }

        draftState.set(draft.id, {
          signature,
          descriptionLength: draft.description.length,
          emittedAt: now,
        });
        options.onAiDraftEvent(draft);
      }
    },
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
