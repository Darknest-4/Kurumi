import { ActivityType, Events } from 'discord.js';
import { defineEvent } from '../core/structures/Event';
import { createLogger } from '../core/logger/logger';

const log = createLogger('ready');

export default defineEvent({
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    log.info(
      { user: client.user?.tag, guilds: client.guilds.cache.size },
      '🌸 Kurumi is online',
    );
    client.user?.setPresence({
      activities: [{ name: 'anime & XP • /help', type: ActivityType.Playing }],
      status: 'online',
    });
    await client.runModuleReadyHooks();
  },
});
