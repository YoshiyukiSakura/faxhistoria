import { prisma } from '../lib/prisma';
import { initializeGameState } from './state.service';

export async function createGame(userId: string, name: string, playerCountry: string, startYear: number) {
  const initialState = initializeGameState(playerCountry, startYear);

  const game = await prisma.game.create({
    data: {
      userId,
      name,
      playerCountry,
      startYear,
      currentYear: startYear,
      currentState: initialState as any,
    },
    select: {
      id: true,
      name: true,
      playerCountry: true,
      startYear: true,
      currentYear: true,
      turnNumber: true,
      status: true,
      createdAt: true,
    },
  });

  // Save initial snapshot at turn 0
  await prisma.gameSnapshot.create({
    data: {
      gameId: game.id,
      turnNumber: 0,
      year: startYear,
      state: initialState as any,
    },
  });

  return game;
}

export async function getGame(gameId: string, userId: string) {
  const game = await prisma.game.findFirst({
    where: { id: gameId, userId },
    include: {
      turns: {
        orderBy: { turnNumber: 'desc' },
        take: 10,
        include: { events: { orderBy: { sequence: 'asc' } } },
      },
    },
  });

  return game;
}

export async function listGames(userId: string) {
  return prisma.game.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      playerCountry: true,
      startYear: true,
      currentYear: true,
      turnNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}
