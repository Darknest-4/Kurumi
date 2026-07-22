import { Events, type Message } from 'discord.js';
import { defineEvent } from '../../../core/structures/Event';
import { prisma } from '../../../core/database/prisma';

/**
 * Grants message XP with a per-user anti-spam cooldown. Amount range and
 * cooldown are DB-driven (`level` / `cooldown` namespaces).
 */
export default defineEvent({
  name: Events.MessageCreate,
  module: 'level',
  async execute(client, message: Message) {
    if (message.author.bot || !message.inGuild()) return;
    const guildId = message.guildId;

    if (!(await client.modules.isEnabled(guildId, 'level'))) return;

    const cooldownSecs = await client.config.getNumber(guildId, 'level', 'message.cooldown', 60);
    if (await client.cooldowns.isOnCooldown(guildId, message.author.id, 'level.message')) return;

    const min = await client.config.getNumber(guildId, 'level', 'message.min', 15);
    const max = await client.config.getNumber(guildId, 'level', 'message.max', 25);
    const amount = Math.floor(Math.random() * (max - min + 1)) + min;

    const result = await client.xp.award(
      guildId,
      message.author.id,
      amount,
      'message',
      message.author.username,
    );
    await client.cooldowns.set(guildId, message.author.id, 'level.message', cooldownSecs);

    // Track message count on the member (for stats & vault auto thresholds).
    await prisma.member.updateMany({
      where: { guildId, userId: message.author.id },
      data: { messages: { increment: 1 } },
    });

    if (result.leveledUp) {
      const announce = await client.config.getBool(guildId, 'level', 'announceLevelUp', true);
      if (announce && message.channel.isTextBased() && 'send' in message.channel) {
        await message.channel
          .send(`🎉 ${message.author}, you reached **level ${result.level}**!`)
          .catch(() => undefined);
      }
    }
  },
});
