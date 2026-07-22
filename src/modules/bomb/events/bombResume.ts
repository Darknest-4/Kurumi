import { Events } from 'discord.js';
import { defineEvent } from '../../../core/structures/Event';
import { BombService } from '../BombService';

export default defineEvent({
  name: Events.ClientReady,
  once: true,
  module: 'bomb',
  async execute(client) {
    await BombService.resume(client);
  },
});
