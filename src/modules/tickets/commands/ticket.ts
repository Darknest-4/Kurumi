import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed, successEmbed } from '../../../utils/embeds';

export default defineCommand({
  module: 'tickets',
  permission: 'tickets.manage',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Post a support ticket panel.')
    .addStringOption((o) => o.setName('message').setDescription('Panel description')),
  async execute({ interaction }) {
    const description =
      interaction.options.getString('message') ?? 'Need help? Click below to open a private ticket.';
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ticketOpen')
        .setLabel('Open Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary),
    );
    await (interaction.channel as TextChannel).send({
      embeds: [baseEmbed().setTitle('🎫 Support').setDescription(description)],
      components: [row],
    });
    await interaction.reply({
      embeds: [successEmbed('Ticket panel posted.')],
      flags: MessageFlags.Ephemeral,
    });
  },
});
