import { Events } from 'discord.js';
import { defineEvent } from '../../../core/structures/Event';
import { GiveawayService } from '../GiveawayService';

export default defineEvent({
  name: Events.ClientReady,
  once: true,
  module: 'giveaway',
  async execute(client) {
    await GiveawayService.resume(client);
  },
});
