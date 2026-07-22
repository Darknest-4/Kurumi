import { Events, type MessageReaction, type User } from 'discord.js';
import { EventState } from '@prisma/client';
import { defineEvent } from '../../../core/structures/Event';
import { prisma } from '../../../core/database/prisma';
import { VaultService } from '../VaultService';

/**
 * Lets members join the vault by reacting with the configured emoji, in
 * addition to the join button. The bot itself adds the reaction on start.
 */
export default defineEvent({
  name: Events.MessageReactionAdd,
  module: 'vault',
  async execute(client, reaction: MessageReaction, user: User) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => undefined);

    const guildId = reaction.message.guildId;
    if (!guildId) return;
    if (!(await client.modules.isEnabled(guildId, 'vault'))) return;

    const emoji = await client.config.getString(guildId, 'vault', 'reactionEmoji', '💰');
    if (reaction.emoji.name !== emoji) return;

    const event = await prisma.vaultEvent.findFirst({
      where: { guildId, messageId: reaction.message.id, state: EventState.ACTIVE },
    });
    if (!event) return;

    const res = await VaultService.join(client, event.id, user.id);
    if (!res.ok) {
      await user.send(`💰 Could not join the vault: ${res.reason}`).catch(() => undefined);
    }
  },
});
