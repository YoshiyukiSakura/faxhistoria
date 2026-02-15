import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';

const SALT_ROUNDS = 10;
const GUEST_DOMAIN = 'guest.faxhistoria.local';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(email: string, password: string, displayName: string) {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { email, passwordHash, displayName },
    select: { id: true, email: true, displayName: true },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createGuestUser() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const email = `guest-${nonce}@${GUEST_DOMAIN}`;
    const password = `guest-${nonce}-secret`;
    const displayName = `Guest-${nonce.slice(-6)}`;

    try {
      return await createUser(email, password, displayName);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Unable to create guest account');
}
