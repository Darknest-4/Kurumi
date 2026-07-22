import { KurumiClient } from '../core/KurumiClient';
import { logger } from '../core/logger/logger';

/**
 * Standalone slash-command deployment (no gateway login). Useful in CI or
 * when rolling out command changes without restarting the bot.
 */
async function main(): Promise<void> {
  const client = new KurumiClient();
  await client.init();
  await client.commandManager.deploy();
  logger.info('Command deployment complete.');
  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err }, 'Command deployment failed');
  process.exit(1);
});
