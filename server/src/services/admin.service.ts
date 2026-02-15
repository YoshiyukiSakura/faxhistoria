import type { AdminStatsResponse } from '@faxhistoria/shared';
import { prisma } from '../lib/prisma';

function toSafeNumber(value: number | bigint | null | undefined): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return value ?? 0;
}

export async function getAdminStats(): Promise<AdminStatsResponse> {
  const [
    playerCount,
    activePlayers,
    totalModelRuns,
    successfulModelRuns,
    tokenSums,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.game.findMany({
      select: { userId: true },
      distinct: ['userId'],
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

  return {
    generatedAt: new Date().toISOString(),
    playerCount,
    activePlayerCount: activePlayers.length,
    tokenUsage: {
      totalModelRuns,
      successfulModelRuns,
      failedModelRuns: totalModelRuns - successfulModelRuns,
      promptTokens,
      outputTokens,
      totalTokens: promptTokens + outputTokens,
    },
  };
}
