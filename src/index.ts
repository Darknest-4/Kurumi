import { env } from './config/env';
import { KurumiClient } from './core/KurumiClient';
import { connectPrisma, disconnectPrisma } from './core/database/prisma';
import { connectRedis, disconnectRedis } from './core/database/redis';
import { logger } from './core/logger/logger';

async function main(): Promise<void> {
  logger.info('Starting Kurumi…');

  await connectPrisma();
  await connectRedis();

  const client = new KurumiClient();
  await client.init();

  // Register/refresh slash commands on boot (guild-scoped in dev).
  await client.commandManager.deploy();

  await client.login(env.DISCORD_TOKEN);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down…');
    try {
      client.destroy();
      await disconnectRedis();
      await disconnectPrisma();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => logger.fatal({ err }, 'uncaughtException'));

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error during startup');
  process.exit(1);
});
