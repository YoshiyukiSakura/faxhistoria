import type { AdminStatsResponse } from '@faxhistoria/shared';
import { GameStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

function toSafeNumber(value: number | bigint | null | undefined): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return value ?? 0;
}

export async function getAdminStats(): Promise<AdminStatsResponse> {
  const [
    users,
    totalModelRuns,
    successfulModelRuns,
    tokenSums,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        lastCallDate: true,
        dailyApiCalls: true,
        games: {
          select: {
            status: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.modelRun.count(),
    prisma.modelRun.count({ where: { success: true } }),
    prisma.modelRun.aggregate({
      _sum: {
        promptTokens: true,
        outputTokens: true,
      },
    }),
  ]);

  const promptTokens = toSafeNumber(tokenSums._sum.promptTokens);
  const outputTokens = toSafeNumber(tokenSums._sum.outputTokens);
  const players = users.map((user) => {
    let activeGames = 0;
    let completedGames = 0;
    let abandonedGames = 0;
    let latestGameAt: Date | null = null;

    for (const game of user.games) {
      if (game.status === GameStatus.ACTIVE) activeGames++;
      if (game.status === GameStatus.COMPLETED) completedGames++;
      if (game.status === GameStatus.ABANDONED) abandonedGames++;
      if (!latestGameAt || game.updatedAt > latestGameAt) {
        latestGameAt = game.updatedAt;
      }
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
      lastCallDate: user.lastCallDate ? user.lastCallDate.toISOString() : null,
      dailyApiCalls: user.dailyApiCalls,
      totalGames: user.games.length,
      activeGames,
      completedGames,
      abandonedGames,
      latestGameAt: latestGameAt ? latestGameAt.toISOString() : null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    playerCount: players.length,
    activePlayerCount: players.filter((player) => player.totalGames > 0).length,
    tokenUsage: {
      totalModelRuns,
      successfulModelRuns,
      failedModelRuns: totalModelRuns - successfulModelRuns,
      promptTokens,
      outputTokens,
      totalTokens: promptTokens + outputTokens,
    },
    players,
  };
}
