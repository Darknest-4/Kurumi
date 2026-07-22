import { SlashCommandBuilder, MessageFlags, ChannelType, type TextChannel } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed } from '../../../utils/embeds';

export default defineCommand({
  module: 'welcome',
  permission: 'welcome.manage',
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome messages.')
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription('Set the welcome channel and message.')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Where to post welcomes')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('message').setDescription('Use {user} {server} {count}').setRequired(true),
        ),
    )
    .addSubcommand((s) => s.setName('disable').setDescription('Turn welcome messages off.'))
    .addSubcommand((s) => s.setName('test').setDescription('Preview the welcome message.')),
  async execute({ client, interaction, guildId }) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message', true);
      await client.config.set(guildId, 'welcome', 'channelId', channel.id);
      await client.config.set(guildId, 'welcome', 'message', message);
      await client.config.set(guildId, 'welcome', 'enabled', true);
      await interaction.reply({
        embeds: [successEmbed(`Welcome messages enabled in <#${channel.id}>.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'disable') {
      await client.config.set(guildId, 'welcome', 'enabled', false);
      await interaction.reply({
        embeds: [successEmbed('Welcome messages disabled.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // test
    const template = await client.config.getString(
      guildId,
      'welcome',
      'message',
      'Welcome {user} to {server}! 🌸',
    );
    const preview = template
      .replaceAll('{user}', `<@${interaction.user.id}>`)
      .replaceAll('{server}', interaction.guild?.name ?? 'this server')
      .replaceAll('{count}', String(interaction.guild?.memberCount ?? 0));
    const channelId = await client.config.getString(guildId, 'welcome', 'channelId', '');
    const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
    if (channel?.isTextBased() && !channel.isDMBased()) {
      await (channel as TextChannel).send({ content: preview }).catch(() => undefined);
    }
    await interaction.reply({
      embeds: [successEmbed(`Preview:\n${preview}`)],
      flags: MessageFlags.Ephemeral,
    });
  },
});
