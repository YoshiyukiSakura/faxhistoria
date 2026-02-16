import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import type { GameState, RecentEventSummary } from '@faxhistoria/shared';
import { initializeGameState } from '../../services/state.service';
import { registerUser, cleanupTestData } from '../e2e/test-helpers';

const prisma = new PrismaClient();

const TURN1_ACTION = 'Expand renewable energy cooperation with Japan and South Korea.';
const TURN2_ACTION = 'Increase Indo-Pacific naval patrol coordination with regional allies.';

const TURN1_EVENT_DESCRIPTION = 'The United States launched regional clean-energy infrastructure talks.';
const TURN2_EVENT_DESCRIPTION = 'Joint maritime patrol drills increased deterrence in contested waters.';

let token = '';
let user: { id: string; email: string; displayName: string } | null = null;
let gameId = '';

async function hydrateAuth(page: Page) {
  if (!user) throw new Error('User setup did not complete');
  await page.addInitScript(
    ({ authToken, authUser }) => {
      localStorage.setItem(
        'auth',
        JSON.stringify({
          state: {
            token: authToken,
            user: authUser,
          },
          version: 0,
        }),
      );
    },
    {
      authToken: token,
      authUser: user,
    },
  );
}

function buildStateWithHistory(): GameState {
  const base = initializeGameState('United States', 2024);
  const recentEvents: RecentEventSummary[] = [
    {
      turnNumber: 1,
      year: 2025,
      description: TURN1_EVENT_DESCRIPTION,
      eventType: 'NARRATIVE',
    },
    {
      turnNumber: 2,
      year: 2026,
      description: TURN2_EVENT_DESCRIPTION,
      eventType: 'NARRATIVE',
    },
  ];

  return {
    ...base,
    currentYear: 2026,
    turnNumber: 2,
    recentEvents,
    worldNarrative:
      'Energy diplomacy and maritime security are both rising priorities in the Indo-Pacific.',
  };
}

async function seedGameWithTurns(userId: string): Promise<string> {
  const state = buildStateWithHistory();
  const game = await prisma.game.create({
    data: {
      userId,
      name: 'Test Game UI Timeline',
      playerCountry: 'United States',
      startYear: 2024,
      currentYear: 2026,
      turnNumber: 2,
      currentState: state as any,
    },
  });

  const turn1 = await prisma.turn.create({
    data: {
      gameId: game.id,
      turnNumber: 1,
      year: 2025,
      playerAction: TURN1_ACTION,
      status: 'COMPLETED',
    },
  });

  const turn2 = await prisma.turn.create({
    data: {
      gameId: game.id,
      turnNumber: 2,
      year: 2026,
      playerAction: TURN2_ACTION,
      status: 'COMPLETED',
    },
  });

  await prisma.turnEvent.createMany({
    data: [
      {
        turnId: turn1.id,
        eventType: 'NARRATIVE',
        sequence: 0,
        eventData: {
          type: 'NARRATIVE',
          description: TURN1_EVENT_DESCRIPTION,
          involvedCountries: ['United States', 'Japan', 'South Korea'],
        } as any,
      },
      {
        turnId: turn2.id,
        eventType: 'NARRATIVE',
        sequence: 0,
        eventData: {
          type: 'NARRATIVE',
          description: TURN2_EVENT_DESCRIPTION,
          involvedCountries: ['United States', 'Japan'],
        } as any,
      },
    ],
  });

  return game.id;
}

test.beforeAll(async ({ request }) => {
  const { res } = await registerUser(request, {
    displayName: 'UI Timeline Tester',
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  token = body.token;
  user = body.user;
  gameId = await seedGameWithTurns(body.user.id);
});

test.afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

test('timeline browsing, historical mode, and visual layout are coherent', async ({ page }) => {
  await hydrateAuth(page);

  await page.goto(`/game/${gameId}`);

  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByText('Viewing turn 2 / 2')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Action' })).toBeVisible();
  await expect(page.locator('textarea')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Turn' })).toBeVisible();

  await page.locator('button', { hasText: 'Turn 1' }).first().click();

  await expect(page).toHaveURL(new RegExp(`/game/${gameId}\\?round=1$`));
  await expect(page.getByText('Viewing turn 1 (1 turn behind current).')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Submitted Action' })).toBeVisible();
  const submittedActionPanel = page
    .locator('div.rounded-xl')
    .filter({ has: page.getByRole('heading', { name: 'Submitted Action' }) })
    .first();
  await expect(submittedActionPanel.getByText(TURN1_ACTION)).toBeVisible();
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit Turn' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Turn 1 Events' })).toBeVisible();
  await expect(page.getByText(TURN1_EVENT_DESCRIPTION)).toBeVisible();

  await page.getByRole('button', { name: 'Go to Current Turn' }).click();

  await expect(page).toHaveURL(new RegExp(`/game/${gameId}$`));
  await expect(page.getByRole('heading', { name: 'Your Action' })).toBeVisible();
  await expect(page.locator('textarea')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Turn' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent Events' })).toBeVisible();

  const mapBox = await page.locator('svg').first().boundingBox();
  const sidebarBox = await page.locator('div.w-96').first().boundingBox();
  expect(mapBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.width).toBeGreaterThanOrEqual(360);
  expect(mapBox!.width).toBeGreaterThan(700);

  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = (globalThis as any).document?.documentElement;
    if (!root) return false;
    return root.scrollWidth > root.clientWidth + 1;
  });
  expect(hasHorizontalOverflow).toBe(false);
});

test('layout remains readable at 1280px desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await hydrateAuth(page);
  await page.goto(`/game/${gameId}`);

  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Action' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent Events' })).toBeVisible();

  const mapBox = await page.locator('svg').first().boundingBox();
  const sidebarBox = await page.locator('div.w-96').first().boundingBox();
  expect(mapBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.width).toBeGreaterThanOrEqual(360);
  expect(mapBox!.width).toBeGreaterThan(500);

  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = (globalThis as any).document?.documentElement;
    if (!root) return false;
    return root.scrollWidth > root.clientWidth + 1;
  });
  expect(hasHorizontalOverflow).toBe(false);
});
