import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  type ButtonInteraction,
} from 'discord.js';
import { defineComponent } from '../../../core/structures/Component';
import { baseEmbed, errorEmbed } from '../../../utils/embeds';

export default defineComponent<ButtonInteraction>({
  kind: 'button',
  id: 'ticketOpen',
  module: 'tickets',
  async execute(interaction, _client, _args) {
    if (!interaction.inCachedGuild()) return;
    const guild = interaction.guild;

    // One open ticket per user (by channel name convention).
    const slug = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;
    const existing = guild.channels.cache.find((c) => c.name === slug);
    if (existing) {
      await interaction.reply({
        embeds: [errorEmbed(`You already have an open ticket: <#${existing.id}>.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const parent = interaction.channel?.isThread() ? null : (interaction.channel as { parentId?: string })?.parentId;
      const channel = await guild.channels.create({
        name: slug,
        type: ChannelType.GuildText,
        parent: parent ?? undefined,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
          ...(guild.members.me ? [{ id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }] : []),
        ],
      });

      const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('ticketClose').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
      );
      await channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [baseEmbed().setTitle('🎫 Ticket').setDescription('A staff member will be with you shortly. Click **Close** when done.')],
        components: [closeRow],
      });
      await interaction.reply({
        embeds: [baseEmbed().setDescription(`Ticket opened: <#${channel.id}>`)],
        flags: MessageFlags.Ephemeral,
      });
    } catch {
      await interaction.reply({
        embeds: [errorEmbed('Could not create the ticket channel (check my permissions).')],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
});
