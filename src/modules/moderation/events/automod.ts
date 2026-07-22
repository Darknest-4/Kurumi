import { Events, PermissionFlagsBits, type Message } from 'discord.js';
import { defineEvent } from '../../../core/structures/Event';

/**
 * Minimal AutoMod: deletes messages with excessive mentions when enabled.
 * Thresholds are DB-driven (`moderation` namespace) and off by default.
 */
export default defineEvent({
  name: Events.MessageCreate,
  module: 'moderation',
  async execute(client, message: Message) {
    if (message.author.bot || !message.inGuild()) return;
    if (!(await client.modules.isEnabled(message.guildId, 'moderation'))) return;

    const enabled = await client.config.getBool(message.guildId, 'moderation', 'automod.enabled', false);
    if (!enabled) return;

    // Never act on members who can manage messages.
    if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    const maxMentions = await client.config.getNumber(message.guildId, 'moderation', 'automod.maxMentions', 5);
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount > maxMentions) {
      await message.delete().catch(() => undefined);
      await message.channel
        .send(`🚫 <@${message.author.id}>, too many mentions (max ${maxMentions}).`)
        .catch(() => undefined);
      await client.logs.record(message.guildId, 'warn', {
        targetId: message.author.id,
        data: { automod: 'mass-mention', count: mentionCount },
      });
    }
  },
});
