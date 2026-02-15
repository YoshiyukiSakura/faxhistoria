import { test, expect, type APIRequestContext } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import type { TurnProgressEvent, TurnResponse } from '@faxhistoria/shared';
import {
  registerUser,
  createGame,
  getGame,
  cleanupTestData,
  prisma,
} from './test-helpers';

test.describe.configure({ mode: 'serial' });

interface ParsedSseFrame {
  event: string;
  payload: TurnProgressEvent;
}

interface ExecutedTurn {
  action: string;
  expectedTurnNumber: number;
  idempotencyKey: string;
  result: TurnResponse;
}

const PLAYER_COUNTRY = 'Japan';
const START_YEAR = 2024;
const LONG_RUN_TIMEOUT_MS = 25 * 60 * 1000; // 25 minutes
const TURN_REQUEST_TIMEOUT_MS = 240_000;
const STREAM_REQUEST_TIMEOUT_MS = 300_000;

const TURN_PLAN: Array<{ mode: 'json' | 'stream'; objective: string }> = [
  { mode: 'json', objective: 'Build chip and energy resilience without provocation' },
  { mode: 'stream', objective: 'Translate economic gains into alliance diplomacy and deterrence' },
  { mode: 'json', objective: 'Balance defense pressure with trade continuity under uncertainty' },
  { mode: 'stream', objective: 'Respond to regional shocks while preserving escalation control' },
  { mode: 'json', objective: 'Consolidate domestic stability and multilateral influence' },
  { mode: 'stream', objective: 'Close the cycle with long-horizon strategy and risk hedging' },
];

function compactText(input: string, maxLength = 180): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /ECONNREFUSED|ECONNRESET|ETIMEDOUT|EPIPE|socket hang up|fetch failed/i.test(err.message);
}

function buildProfessionalAction(
  turnIndex: number,
  objective: string,
  previous?: TurnResponse,
): string {
  if (!previous) {
    return [
      `Turn ${turnIndex} objective: ${objective}.`,
      `As ${PLAYER_COUNTRY}, use a conservative pro strategy:`,
      'prioritize industry, energy diversity, alliance credibility, and controlled deterrence.',
    ].join(' ');
  }

  const primaryEventType = previous.events[0]?.type ?? 'NARRATIVE';
  const eventDigest = previous.events
    .slice(0, 3)
    .map((event) => `${event.type}:${compactText(event.description, 80)}`)
    .join(' | ');
  const yearSummary = compactText(previous.yearSummary, 220);

  return [
    `Turn ${turnIndex} objective: ${objective}.`,
    `Adjust from prior ${primaryEventType} outcomes with pro-level risk control.`,
    `Last year summary: ${yearSummary}.`,
    `Recent event digest: ${eventDigest}.`,
    'Action style: keep deterrence credible, avoid overextension, preserve growth and diplomatic optionality.',
  ].join(' ');
}

function parseSseFrames(raw: string): ParsedSseFrame[] {
  const parsed: ParsedSseFrame[] = [];
  const frames = raw.split(/\r?\n\r?\n/);

  for (const frame of frames) {
    const trimmed = frame.trim();
    if (!trimmed) continue;

    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of trimmed.split(/\r?\n/)) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) continue;
    try {
      const payload = JSON.parse(dataLines.join('\n')) as TurnProgressEvent;
      parsed.push({ event: eventName, payload });
    } catch {
      // Ignore malformed frames.
    }
  }

  return parsed;
}

function findLastEventFrame(frames: ParsedSseFrame[], eventName: string): ParsedSseFrame | undefined {
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].event === eventName) return frames[i];
  }
  return undefined;
}

function firstStageIndex(frames: ParsedSseFrame[], stage: TurnProgressEvent['stage']): number {
  return frames.findIndex((frame) => frame.payload.stage === stage);
}

function assertStreamMilestones(frames: ParsedSseFrame[]): void {
  expect(frames.length).toBeGreaterThan(0);
  const progressFrames = frames.filter((frame) => frame.event === 'progress');
  expect(progressFrames.length).toBeGreaterThan(0);

  let lastProgress = -1;
  for (const frame of progressFrames) {
    expect(frame.payload.progress).toBeGreaterThanOrEqual(lastProgress);
    lastProgress = frame.payload.progress;
  }

  const idxValidating = firstStageIndex(frames, 'VALIDATING');
  const idxApplying = firstStageIndex(frames, 'APPLYING_EVENTS');
  const idxPersisting = firstStageIndex(frames, 'PERSISTING');
  const idxCompleted = frames.findIndex(
    (frame) => frame.event === 'complete' && frame.payload.stage === 'COMPLETED',
  );

  expect(idxValidating).toBeGreaterThanOrEqual(0);
  expect(idxApplying).toBeGreaterThan(idxValidating);
  expect(idxPersisting).toBeGreaterThan(idxApplying);
  expect(idxCompleted).toBeGreaterThan(idxPersisting);

  const hasAiStage = frames.some(
    (frame) => frame.payload.stage === 'PROCESSING_AI' || frame.payload.stage === 'AI_RETRY',
  );
  expect(hasAiStage).toBe(true);

  const liveEvents = progressFrames
    .map((frame) => frame.payload.liveEvent)
    .filter((event): event is NonNullable<TurnProgressEvent['liveEvent']> => event !== undefined);

  if (liveEvents.length === 0) return;

  const total = liveEvents[0].total;
  const seenSequences = new Set<number>();
  for (const event of liveEvents) {
    expect(event.total).toBe(total);
    expect(event.sequence).toBeGreaterThanOrEqual(1);
    expect(event.sequence).toBeLessThanOrEqual(total);
    seenSequences.add(event.sequence);
  }
  expect(seenSequences.size).toBe(liveEvents.length);
}

async function submitJsonTurnLongRun(
  request: APIRequestContext,
  token: string,
  gameId: string,
  action: string,
  expectedTurnNumber: number,
  maxRetries = 4,
): Promise<ExecutedTurn> {
  let idempotencyKey = uuidv4();
  let lastError = 'unknown';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await request.post(`/api/games/${gameId}/turn`, {
        headers: {
          authorization: `Bearer ${token}`,
          'x-idempotency-key': idempotencyKey,
        },
        data: { action, expectedTurnNumber },
        timeout: TURN_REQUEST_TIMEOUT_MS,
      });

      if (res.status() === 200) {
        const body = (await res.json()) as TurnResponse;
        return { action, expectedTurnNumber, idempotencyKey, result: body };
      }

      const body = await res.json().catch(() => ({}));
      const message = String((body as { message?: string }).message ?? `HTTP ${res.status()}`);
      lastError = message;

      if (res.status() === 500 && attempt < maxRetries) {
        // Failed keys are not reusable after AI failure.
        idempotencyKey = uuidv4();
        await wait(5000);
        continue;
      }
      if (res.status() === 400 && /previously failed/i.test(message) && attempt < maxRetries) {
        idempotencyKey = uuidv4();
        await wait(2000);
        continue;
      }
      if (res.status() === 409 && /already being processed/i.test(message) && attempt < maxRetries) {
        await wait(3000);
        continue;
      }

      throw new Error(`Turn failed (${res.status()}): ${message}`);
    } catch (err) {
      if (attempt < maxRetries && isTransientNetworkError(err)) {
        await wait(5000);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Turn failed after ${maxRetries} attempts: ${lastError}`);
}

async function submitStreamTurnLongRun(
  request: APIRequestContext,
  token: string,
  gameId: string,
  action: string,
  expectedTurnNumber: number,
  maxRetries = 4,
): Promise<ExecutedTurn & { frames: ParsedSseFrame[] }> {
  let idempotencyKey = uuidv4();
  let lastError = 'stream ended before completion';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await request.post(`/api/games/${gameId}/turn/stream`, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'text/event-stream',
          'x-idempotency-key': idempotencyKey,
        },
        data: { action, expectedTurnNumber },
        timeout: STREAM_REQUEST_TIMEOUT_MS,
      });

      if (res.status() !== 200) {
        const body = await res.json().catch(() => ({}));
        const message = String((body as { message?: string }).message ?? `HTTP ${res.status()}`);
        throw new Error(`Stream request failed (${res.status()}): ${message}`);
      }

      const rawBody = await res.text();
      const frames = parseSseFrames(rawBody);
      const completeFrame = findLastEventFrame(frames, 'complete');
      if (completeFrame?.payload.result) {
        assertStreamMilestones(frames);
        return {
          action,
          expectedTurnNumber,
          idempotencyKey,
          frames,
          result: completeFrame.payload.result,
        };
      }

      const errorFrame = findLastEventFrame(frames, 'error');
      const statusCode = errorFrame?.payload.error?.statusCode ?? 500;
      lastError =
        errorFrame?.payload.error?.message ??
        errorFrame?.payload.message ??
        lastError;

      if (statusCode === 500 && attempt < maxRetries) {
        idempotencyKey = uuidv4();
        await wait(5000);
        continue;
      }
      if (statusCode === 409 && /already being processed/i.test(lastError) && attempt < maxRetries) {
        await wait(3000);
        continue;
      }

      throw new Error(`Stream turn failed (${statusCode}): ${lastError}`);
    } catch (err) {
      if (attempt < maxRetries && isTransientNetworkError(err)) {
        await wait(5000);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Stream turn failed after ${maxRetries} attempts: ${lastError}`);
}

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe('Professional Player Multi-turn Long Run E2E', () => {
  test('should cover a real long-running journey with stream + multi-turn dialogue', async ({ request }) => {
    test.slow();
    test.setTimeout(LONG_RUN_TIMEOUT_MS);

    const { res: registerRes } = await registerUser(request);
    expect(registerRes.status()).toBe(201);
    const auth = await registerRes.json();
    const token = auth.token as string;
    const userId = auth.user.id as string;

    const gameRes = await createGame(request, token, {
      name: 'Test Game Pro Player Long Run',
      playerCountry: PLAYER_COUNTRY,
      startYear: START_YEAR,
    });
    expect(gameRes.status()).toBe(201);
    const gameId = (await gameRes.json()).id as string;

    const userBefore = await prisma.user.findUnique({ where: { id: userId } });
    expect(userBefore).not.toBeNull();
    const callsBefore = userBefore!.dailyApiCalls;

    const history: ExecutedTurn[] = [];
    const turnIds = new Set<string>();
    let expectedTurnNumber = 0;
    let previous: TurnResponse | undefined;
    let replayCandidate: ExecutedTurn | null = null;

    for (let i = 0; i < TURN_PLAN.length; i++) {
      const step = TURN_PLAN[i];
      const action = buildProfessionalAction(i + 1, step.objective, previous);

      let executed: ExecutedTurn;
      if (step.mode === 'stream') {
        const streamed = await submitStreamTurnLongRun(
          request,
          token,
          gameId,
          action,
          expectedTurnNumber,
        );
        executed = {
          action: streamed.action,
          expectedTurnNumber: streamed.expectedTurnNumber,
          idempotencyKey: streamed.idempotencyKey,
          result: streamed.result,
        };
        if (!replayCandidate) {
          replayCandidate = executed;
        }
      } else {
        executed = await submitJsonTurnLongRun(
          request,
          token,
          gameId,
          action,
          expectedTurnNumber,
        );
      }

      const turn = executed.result;
      expect(turn.turnNumber).toBe(expectedTurnNumber + 1);
      expect(turn.stateVersion).toBe(expectedTurnNumber + 1);
      expect(turn.year).toBe(START_YEAR + expectedTurnNumber + 1);
      expect(turn.events.length).toBeGreaterThanOrEqual(1);
      expect(turn.events.length).toBeLessThanOrEqual(10);
      expect(turn.worldNarrative.trim().length).toBeGreaterThan(20);
      expect(turn.yearSummary.trim().length).toBeGreaterThan(20);
      expect(turnIds.has(turn.turnId)).toBe(false);

      turnIds.add(turn.turnId);
      history.push(executed);
      previous = turn;
      expectedTurnNumber++;
    }

    expect(history.length).toBe(TURN_PLAN.length);
    expect(replayCandidate).not.toBeNull();

    const finalGameRes = await getGame(request, token, gameId);
    expect(finalGameRes.status()).toBe(200);
    const finalGame = await finalGameRes.json();
    expect(finalGame.turnNumber).toBe(TURN_PLAN.length);
    expect(finalGame.currentYear).toBe(START_YEAR + TURN_PLAN.length);
    expect(finalGame.currentState.turnNumber).toBe(TURN_PLAN.length);
    expect(finalGame.currentState.currentYear).toBe(START_YEAR + TURN_PLAN.length);
    expect(finalGame.currentState.playerCountry).toBe(PLAYER_COUNTRY);
    expect(finalGame.currentState.recentEvents.length).toBeGreaterThan(0);
    expect(finalGame.currentState.recentEvents.length).toBeLessThanOrEqual(18);
    expect(finalGame.turns.length).toBeGreaterThanOrEqual(TURN_PLAN.length);
    expect(finalGame.turns[0].id).toBe(history[history.length - 1].result.turnId);

    const replay = replayCandidate!;
    const replayRes = await request.post(`/api/games/${gameId}/turn`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': replay.idempotencyKey,
      },
      data: {
        action: replay.action,
        expectedTurnNumber: replay.expectedTurnNumber,
      },
      timeout: 30_000,
    });
    expect(replayRes.status()).toBe(200);
    const replayBody = (await replayRes.json()) as TurnResponse;
    expect(replayBody.turnId).toBe(replay.result.turnId);
    expect(replayBody.turnNumber).toBe(replay.result.turnNumber);
    expect(replayBody.stateVersion).toBe(replay.result.stateVersion);
    expect(replayBody.year).toBe(replay.result.year);

    const gameAfterReplayRes = await getGame(request, token, gameId);
    expect(gameAfterReplayRes.status()).toBe(200);
    const gameAfterReplay = await gameAfterReplayRes.json();
    expect(gameAfterReplay.turnNumber).toBe(TURN_PLAN.length);

    const staleKey = uuidv4();
    const staleExpectedTurnNumber = Math.max(0, TURN_PLAN.length - 3);
    const staleRes = await request.post(`/api/games/${gameId}/turn`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': staleKey,
      },
      data: {
        action: 'Old-tab stale submit after long session',
        expectedTurnNumber: staleExpectedTurnNumber,
      },
    });
    expect(staleRes.status()).toBe(409);
    const staleBody = await staleRes.json();
    expect(staleBody.error).toBe('CONFLICT');
    expect(staleBody.currentTurnNumber).toBe(TURN_PLAN.length);

    const staleRecord = await prisma.idempotencyKey.findUnique({
      where: {
        gameId_key: {
          gameId,
          key: staleKey,
        },
      },
    });
    expect(staleRecord).toBeNull();

    const userAfter = await prisma.user.findUnique({ where: { id: userId } });
    expect(userAfter).not.toBeNull();
    expect(userAfter!.dailyApiCalls).toBe(callsBefore + TURN_PLAN.length);
  });
});
