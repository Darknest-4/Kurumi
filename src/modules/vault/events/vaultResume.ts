import { Events } from 'discord.js';
import { defineEvent } from '../../../core/structures/Event';
import { VaultService } from '../VaultService';

/** Re-arm any vault events that were still active before a restart. */
export default defineEvent({
  name: Events.ClientReady,
  once: true,
  module: 'vault',
  async execute(client) {
    await VaultService.resume(client);
  },
});
