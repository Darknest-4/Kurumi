import { PrismaClient } from '@prisma/client';
import { isDev } from '../../config/env';
import { createLogger } from '../logger/logger';

const log = createLogger('prisma');

/**
 * Singleton Prisma client. In dev we cache it on `globalThis` to avoid
 * exhausting connections across hot reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['warn', 'error'] : ['error'],
  });

if (isDev) globalForPrisma.prisma = prisma;

export async function connectPrisma(): Promise<void> {
  await prisma.$connect();
  log.info('PostgreSQL connected');
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  log.info('PostgreSQL disconnected');
}
