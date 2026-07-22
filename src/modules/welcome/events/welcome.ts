import { Events, type GuildMember, type TextChannel } from 'discord.js';
import { defineEvent } from '../../../core/structures/Event';

/**
 * Sends a configurable welcome message. Channel, message and enabled flag are
 * all DB-driven (`welcome` namespace). Placeholders: {user} {server} {count}.
 */
export default defineEvent({
  name: Events.GuildMemberAdd,
  module: 'welcome',
  async execute(client, member: GuildMember) {
    const guildId = member.guild.id;
    if (!(await client.modules.isEnabled(guildId, 'welcome'))) return;
    if (!(await client.config.getBool(guildId, 'welcome', 'enabled', false))) return;

    const channelId = await client.config.getString(guildId, 'welcome', 'channelId', '');
    if (!channelId) return;

    const template = await client.config.getString(
      guildId,
      'welcome',
      'message',
      'Welcome {user} to {server}! 🌸',
    );
    const content = template
      .replaceAll('{user}', `<@${member.id}>`)
      .replaceAll('{server}', member.guild.name)
      .replaceAll('{count}', String(member.guild.memberCount));

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased() && !channel.isDMBased()) {
      await (channel as TextChannel).send({ content }).catch(() => undefined);
    }
  },
});
